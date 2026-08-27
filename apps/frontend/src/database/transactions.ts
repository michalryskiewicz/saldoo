import {
  toDBTransaction,
  allocateTransactionsToOccurrences,
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
import type { ParsedTransaction } from '@/lib/banks/contract.ts';

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
  /**
   * The goal this payment was put towards, when it is money set aside rather than a cost.
   *
   * Beside `expenseId` and not instead of it, but in practice exclusive: one transfer is either
   * something spent or something saved, and filing it as both would have it counted twice.
   */
  goalId?: string;
  expense?: DBExpense;

  strategyPart?: STRATEGY_PART;

  tag?: DBTag;
  tagId?: string;

  duties?: string[];
};

/**
 * Stores what a parser read, and only what is not already held.
 *
 * Takes payments rather than rows, and a bank's id rather than a bank's format: which columns mean
 * what was decided upstream by the parser, and this stays the one place that decides what is new.
 */
export const addDBTransactions = async (sourceBank: string, parsed: ParsedTransaction[]) => {
  try {
    const transactions = await Promise.all(
      parsed.map((transaction) => toDBTransaction(transaction, sourceBank))
    );
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
  changes: Pick<DBTransaction, 'expenseId' | 'goalId' | 'strategyPart' | 'tagId'>;
};

/**
 * Updates transactions and resolves duties for any updated expenseId.
 */
export const updateDBTransactions = async (payload: UpdateDBTransactionReq[]) => {
  for (const { key, changes } of payload)
    await documentSession.update('transactions', key as string, changes);

  // Find all unique expenseIds in the payload
  const expenseIds = Array.from(new Set(payload.map((p) => p.changes.expenseId).filter(Boolean)));
  const goalIds = Array.from(new Set(payload.map((p) => p.changes.goalId).filter(Boolean)));

  // For each expenseId, resolve duties
  for (const expenseId of expenseIds) {
    await resolveDutiesForExpense(expenseId as string);
  }

  for (const goalId of goalIds) {
    await resolveContributionsForGoal(goalId as string);
  }
  await setLastUpdated();
  outbox.markDirty();
};

/**
 * Attaches every payment filed against this goal to the contribution it settles.
 *
 * The mirror of `resolveDutiesForExpense`, and deliberately the same allocator: one payment to at
 * most one contribution, the closest pairing first, an accepted pairing kept, and a rejected one
 * passed over rather than disqualifying the contribution. Those properties were bought once in
 * #69 and a second implementation is where two screens start disagreeing.
 *
 * A contribution is never *created* here. The figure grows on what somebody declared; a statement
 * says how much of it is backed, and that is all it says.
 */
export const resolveContributionsForGoal = async (goalId: string) => {
  const contributions = (await db.contributions.toArray()).filter(
    (contribution) => contribution.goalId === goalId
  );

  const transactions = (await db.transactions.toArray()).filter(
    (tx) => tx.goalId === goalId && !!tx.transactionDate
  );

  const allocation = allocateTransactionsToOccurrences({
    occurrences: contributions.map((contribution) => ({
      ...contribution,
      executionDate: new Date(contribution.contributedAt),
    })),
    transactions,
  });

  const byId = new Map(contributions.map((contribution) => [contribution.id, contribution]));

  for (const { occurrenceId, transactionId } of allocation) {
    if (byId.get(occurrenceId)?.transactionId === transactionId) continue;

    await documentSession.update('contributions', occurrenceId, { transactionId });
  }

  await setLastUpdated();
  outbox.markDirty();
};

/**
 * Ticks every duty of this expense that a payment settles.
 *
 * The pairing lives in `allocateTransactionsToOccurrences`, which needs every duty and every
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

  const allocation = allocateTransactionsToOccurrences({
    occurrences: duties.map((duty) => ({ ...duty, executionDate: new Date(duty.executionDate) })),
    transactions,
  });

  const dutiesById = new Map(duties.map((duty) => [duty.id, duty]));

  for (const { occurrenceId, transactionId } of allocation) {
    const duty = dutiesById.get(occurrenceId);
    if (duty?.resolved && duty.transactionId === transactionId) continue;

    await documentSession.update('duties', occurrenceId, { resolved: true, transactionId });
  }

  await setLastUpdated();
  outbox.markDirty();
};
