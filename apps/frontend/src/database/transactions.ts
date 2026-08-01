import {
  mapBankRowToDBTransaction,
  allocateTransactionsToDuties,
} from '@/database/services/transactions.service.ts';
import { db } from '@/database/index.ts';
import { toast } from 'sonner';
import i18n from '@/i18n.ts';
import { uniqBy } from 'lodash';
import type { DBExpense } from '@/database/expenses.ts';
import type { Currency, STRATEGY_PART } from '@/constant.ts';
import { setLastUpdated } from '@/database/meta.ts';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import type { DBTag } from '@/database/tags.ts';

export type DBTransaction = {
  id: string;
  createdAt: Date;
  updatedAt?: Date;

  transactionId?: string;
  sourceBank: string;
  amount: number;
  currency: Currency;
  transactionDate: string;

  description: string;
  hash: string;
  rawData?: unknown; // Store original CSV row or parsed object

  expenseId?: string;
  expense?: DBExpense;

  strategyPart?: STRATEGY_PART;

  tag?: DBTag;
  tagId?: string;

  duties?: string[];
};

export const addDBTransactions = async (bank: string, rows: unknown[][]) => {
  try {
    const transactions = await Promise.all(rows.map((row) => mapBankRowToDBTransaction(bank, row)));
    const transactionsWithUniqueHashes = uniqBy<DBTransaction>(transactions, (t) => t.hash);
    const alreadyAddedTransactions = await db.transactions.toArray();
    const existingHashes = new Set(alreadyAddedTransactions.map((t) => t.hash));
    const newUniqueTransactions = transactionsWithUniqueHashes.filter(
      (t) => !existingHashes.has(t.hash)
    );

    for (const transaction of newUniqueTransactions)
      await documentSession.put('transactions', transaction);

    console.log('ADDED: ', newUniqueTransactions.length, ' transactions');
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.upload-transaction'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.upload-transaction'));
  }
};

type UpdateDBTransactionReq = {
  key: string;
  changes: Pick<DBTransaction, 'expenseId' | 'strategyPart' | 'tagId'>;
};

/**
 * Updates transactions and resolves duties for any updated expenseId.
 */
export const updateDBTransactions = async (payload: UpdateDBTransactionReq[]) => {
  for (const { key, changes } of payload)
    await documentSession.update('transactions', key as string, changes);

  // Find all unique expenseIds in the payload
  const expenseIds = Array.from(new Set(payload.map((p) => p.changes.expenseId).filter(Boolean)));

  // For each expenseId, resolve duties
  for (const expenseId of expenseIds) {
    await resolveDutiesForExpense(expenseId as string);
  }
  await setLastUpdated();
  outbox.markDirty();
};

/**
 * Ticks every duty of this expense that a payment settles.
 *
 * The pairing lives in `allocateTransactionsToDuties`, which needs every duty and every
 * payment at once: no duty on its own can tell whether the payment beside it has already
 * settled its neighbour.
 */
export const resolveDutiesForExpense = async (expenseId: string) => {
  const duties = (await db.duties.toArray()).filter(
    (duty) => duty.expenseId === expenseId && !!duty.executionDate
  );

  const transactions = (await db.transactions.toArray()).filter(
    (tx) => tx.expenseId === expenseId && !!tx.transactionDate
  );

  const allocation = allocateTransactionsToDuties({
    duties: duties.map((duty) => ({ ...duty, executionDate: new Date(duty.executionDate) })),
    transactions,
  });

  const dutiesById = new Map(duties.map((duty) => [duty.id, duty]));

  for (const { dutyId, transactionId } of allocation) {
    const duty = dutiesById.get(dutyId);
    if (duty?.resolved && duty.transactionId === transactionId) continue;

    await documentSession.update('duties', dutyId, { resolved: true, transactionId });
  }

  await setLastUpdated();
  outbox.markDirty();
};
