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
import type { ParsedTransaction, ParseWarning } from '@/lib/banks/contract.ts';
import {
  reportOf,
  type ImportReport,
} from '@/features/transactions/services/import-report.service.ts';
import { v4 as uuidv4 } from 'uuid';
import { hashString } from '@/lib/helpers.ts';
import { SHEET_ID } from '@/lib/saldoo-sheet/format.ts';
import type { SheetRow } from '@/lib/saldoo-sheet/read.ts';
import { planSheet } from '@/features/transactions/services/sheet-plan.service.ts';
import { getSettings } from '@/database/settings.ts';

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
 * Stores what a parser read, and says exactly what became of every row.
 *
 * Takes payments rather than rows, and a bank's id rather than a bank's format: which columns mean
 * what was decided upstream by the parser, and this stays the one place that decides what is new.
 *
 * **Row by row, and a failure does not end the import.** Storing them in one loop that throws left
 * whatever had already landed in place and said "could not upload" over the top of it — so nobody
 * could tell a file that stored nothing from one that stored half. Each write now stands or falls
 * on its own and is counted either way, which is what makes the report's arithmetic add up to the
 * rows the file had.
 */
export const addDBTransactions = async (
  sourceBank: string,
  parsed: ParsedTransaction[],
  unreadable: ParseWarning[] = []
): Promise<ImportReport> => {
  try {
    const transactions = await Promise.all(
      parsed.map((transaction) => toDBTransaction(transaction, sourceBank))
    );

    const distinct = uniqBy<DBTransaction>(transactions, (t) => t.hash);
    const alreadyHeld = new Set((await db.transactions.toArray()).map((t) => t.hash));
    const fresh = distinct.filter((t) => !alreadyHeld.has(t.hash));

    const stored: DBTransaction[] = [];
    let notStored = 0;

    for (const transaction of fresh) {
      try {
        await documentSession.put('transactions', transaction);
        stored.push(transaction);
      } catch (e) {
        console.error(e);
        notStored += 1;
      }
    }

    if (stored.length) {
      await setLastUpdated();
      outbox.markDirty();
    }

    toast(i18n.t(notStored ? 'errors.upload-transaction' : 'success.upload-transaction'));

    return reportOf({
      imported: stored.length,
      duplicates: distinct.length - fresh.length,
      repeatedInFile: transactions.length - distinct.length,
      unreadable,
      notStored,
      storedDates: stored.map((t) => t.transactionDate),
    });
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.upload-transaction'));

    // Nothing was read, so nothing can be claimed: the rows are reported as not stored rather than
    // as a clean import of nought.
    return reportOf({
      imported: 0,
      duplicates: 0,
      repeatedInFile: 0,
      unreadable,
      notStored: parsed.length,
      storedDates: [],
    });
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

/**
 * Applies one of Saldoo's own sheets: inserting, updating and deleting what it asks for.
 *
 * The first write path in the app that does more than insert, and the reason the format exists at
 * all — categorising four hundred payments is one drag in a spreadsheet and four hundred drawers
 * here. What may be changed and what may not is decided by `planSheet`, which is a pure function
 * over the rows and what is held; this executes the plan and counts what happened.
 *
 * **A deletion goes through `documentSession.remove`,** so it propagates as a deletion. Removing
 * the row from Dexie alone would have the record arrive back from the next device that syncs.
 *
 * **An inserted row keeps no `rawData`,** which is not an omission: `rawData` is present exactly
 * when a bank stated a payment, and that presence is what makes its figures uneditable. A row
 * somebody typed into a spreadsheet is theirs in full, and giving it a `rawData` would quietly
 * freeze it.
 */
export const applyDBSheet = async (rows: readonly SheetRow[]): Promise<ImportReport> => {
  const [heldTransactions, tags, goals, expenses, settings] = await Promise.all([
    db.transactions.toArray(),
    db.tags.toArray(),
    db.goals.toArray(),
    db.expenses.toArray(),
    getSettings(),
  ]);

  const plan = planSheet(rows, {
    held: heldTransactions,
    tags,
    goals: goals.map((goal) => ({ id: goal.id, name: goal.description })),
    expenses: expenses.map((expense) => ({ id: expense.id, name: expense.description })),
    defaultCurrency: settings.currency,
  });

  const alreadyHeld = new Set(heldTransactions.map((transaction) => transaction.hash));
  const seenInFile = new Set<string>();

  const stored: DBTransaction[] = [];
  let duplicates = 0;
  let repeatedInFile = 0;
  let notStored = 0;

  for (const insert of plan.inserts) {
    // Hashed over what the row says rather than over the row as written, because a sheet has no
    // original to hash: the columns can be reordered, renamed into the other language, or the file
    // rewritten by a spreadsheet, and none of that makes it a different payment. The consequence
    // worth knowing is that two rows agreeing on all four are one payment as far as this can tell.
    const hash = await hashString(
      [insert.transactionDate, insert.description, insert.amount, insert.currency].join('|')
    );

    if (alreadyHeld.has(hash)) {
      duplicates += 1;
      continue;
    }

    if (seenInFile.has(hash)) {
      repeatedInFile += 1;
      continue;
    }

    seenInFile.add(hash);

    // Written out field by field rather than spread, because a plan carries one thing a record must
    // not: `row` says where in the file this came from, which stops meaning anything the moment the
    // file is closed.
    const transaction: DBTransaction = {
      // The id the file states is kept, which is what makes an old export a restore rather than a
      // second copy of everything in it. Minted only for a row somebody typed themselves.
      id: insert.id ?? uuidv4(),
      createdAt: new Date(),
      sourceBank: SHEET_ID,
      hash,
      transactionDate: insert.transactionDate,
      description: insert.description,
      amount: insert.amount,
      currency: insert.currency,
      tagId: insert.tagId,
      goalId: insert.goalId,
      expenseId: insert.expenseId,
      strategyPart: insert.strategyPart,
    };

    try {
      await documentSession.put('transactions', transaction);
      stored.push(transaction);
    } catch (e) {
      console.error(e);
      notStored += 1;
    }
  }

  let updated = 0;

  for (const update of plan.updates) {
    try {
      await documentSession.update('transactions', update.id, {
        ...update.changes,
        updatedAt: new Date(),
      });
      updated += 1;
    } catch (e) {
      console.error(e);
      notStored += 1;
    }
  }

  let deleted = 0;

  for (const deletion of plan.deletions) {
    try {
      await documentSession.remove('transactions', deletion.id);
      deleted += 1;
    } catch (e) {
      console.error(e);
      notStored += 1;
    }
  }

  // The same settling the drawer does, for the same reason: filing a payment against a cost is what
  // ticks that cost's duty off, and a sheet that assigned four hundred of them while leaving every
  // duty open would be a second way of doing the same thing that does not do the same thing.
  const expenseIds = new Set(
    [...plan.inserts, ...plan.updates.map((update) => update.changes)]
      .map((fields) => fields.expenseId)
      .filter((id): id is string => !!id)
  );
  const goalIds = new Set(
    [...plan.inserts, ...plan.updates.map((update) => update.changes)]
      .map((fields) => fields.goalId)
      .filter((id): id is string => !!id)
  );

  for (const expenseId of expenseIds) await resolveDutiesForExpense(expenseId);
  for (const goalId of goalIds) await resolveContributionsForGoal(goalId);

  if (stored.length || updated || deleted) {
    await setLastUpdated();
    outbox.markDirty();
  }

  toast(i18n.t(notStored ? 'errors.upload-transaction' : 'success.upload-transaction'));

  return reportOf({
    imported: stored.length,
    // What re-importing an untouched export produces: every row named a record we hold and asked
    // for nothing. Stated plainly rather than as a problem — it is the file working as intended.
    duplicates: duplicates + plan.unchanged,
    repeatedInFile,
    unreadable: [],
    notStored,
    updated,
    deleted,
    refused: plan.refusals,
    rows: rows.length,
    storedDates: stored.map((transaction) => transaction.transactionDate),
  });
};
