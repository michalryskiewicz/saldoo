import { mapBankRowToDBTransaction } from '@/database/services/transactions.service.ts';
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
 * Resolves duties for a given expenseId by matching transactions within ±4 days of duty executionDate.
 * Updates matched duties: sets resolved=true and transactionId.
 */
export const resolveDutiesForExpense = async (expenseId: string) => {
  // Fetch all duties for the expenseId
  const duties = (await db.duties.toArray()).filter((duty) => duty.expenseId === expenseId);

  // Fetch all transactions for the expenseId and userId, with non-null transactionDate
  const transactions = (await db.transactions.toArray()).filter(
    (tx) => tx.expenseId === expenseId && !!tx.transactionDate
  );

  // For each duty, find a transaction within ±4 days of executionDate
  const dutiesToUpdate: { id: string; transactionId: string }[] = [];
  for (const duty of duties) {
    if (!duty.executionDate) continue;
    const dutyDate = new Date(duty.executionDate);
    const minDate = new Date(dutyDate);
    minDate.setDate(dutyDate.getDate() - 4);
    const maxDate = new Date(dutyDate);
    maxDate.setDate(dutyDate.getDate() + 4);
    const matchingTransaction = transactions.find((t) => {
      if (!t.transactionDate) return false;
      const txDate = new Date(t.transactionDate);
      return txDate >= minDate && txDate <= maxDate;
    });
    if (matchingTransaction) {
      dutiesToUpdate.push({
        id: duty.id,
        transactionId: matchingTransaction.id,
      });
    }
  }

  // Update all matched duties: set resolved=true and transactionId
  for (const dutyUpdate of dutiesToUpdate) {
    await documentSession.update('duties', dutyUpdate.id, {
      resolved: true,
      transactionId: dutyUpdate.transactionId,
    });
  }
  await setLastUpdated();
  outbox.markDirty();
};
