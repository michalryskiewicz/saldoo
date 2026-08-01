import type { FREQUENCY } from '@/constant.ts';
import { db } from '@/database/index';
import type { DBExpense } from '@/database/expenses';
import { getExpensesInSelectedDateRange } from '@/lib/expenses.ts';
import {
  carryMarksToMovedOccurrences,
  createDutiesForSelectedDateRange,
  selectStaleDuties,
} from '@/database/services/duties.service.ts';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { setLastUpdated } from '@/database/meta.ts';
import { endOfMonth, startOfMonth } from 'date-fns';

// ===========================================================================
// DB Types
// ===========================================================================
export type DBDuty = {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
  resolved?: boolean;
  ignored?: boolean;
  frequency?: FREQUENCY;
  executionDate: Date;
  expenseId?: string;
  /** `null` where a match was made and the user rejected it — see `resolveDBDuty`. */
  transactionId?: string | null;
  /**
   * Payments the user has said are not this duty's.
   *
   * Matching is a ±4 day window, so it can land on the wrong payment. Recording the
   * rejection rather than blocking the duty outright leaves the next payment in the same
   * window free to match: a flag would punish the person for correcting the guess.
   */
  rejectedTransactionIds?: string[];
  hash: string;
  // Relations (optional, can be expanded as needed)
  expense?: DBExpense; // Replace 'any' with Expense type if available
  transaction?: unknown; // Replace 'any' with Transaction type if available
};

type AddDBDutiesForDateRangeProps = {
  startDate: Date;
  endDate: Date;
};

type AddDBDutiesOptions = {
  /**
   * Sweep duties the current expense definitions no longer call for, from this date to the
   * end of the range. Omit to only add what is missing. A paid duty is never swept — see
   * `selectStaleDuties`.
   */
  regenFrom?: Date | null;
};

export async function addDBDutiesForDateRange(
  { startDate, endDate }: AddDBDutiesForDateRangeProps,
  options?: AddDBDutiesOptions
) {
  // 1. Get all expenses for user
  const expenses: DBExpense[] = await db.expenses.toArray();

  // 2. Filter expenses in selected date range
  const expensesThatShouldBeExecuted = getExpensesInSelectedDateRange(expenses, {
    start: startDate,
    end: endDate,
  });

  // 3. Generate the duties the current definitions call for
  const duties = await createDutiesForSelectedDateRange({
    expenses: expensesThatShouldBeExecuted,
    startDate,
    endDate,
  });

  // Hand the marks of re-dated occurrences over before anything else touches them: the
  // correction of the daily day-shift changes an occurrence's date, and the date is its
  // identity, so a paid day would otherwise be stranded under a date nothing generates.
  const carried = carryMarksToMovedOccurrences({
    stored: await db.duties.toArray(),
    expected: duties,
  });

  for (const { staleId, hash, marks } of carried) {
    const occurrence = duties.find((duty) => duty.hash === hash);
    if (!occurrence) continue;

    await documentSession.put('duties', {
      ...occurrence,
      ...marks,
      id: hash,
      createdAt: new Date(),
      executionDate: new Date(occurrence.executionDate),
    });
    await documentSession.remove('duties', staleId);
  }

  // Sweep whatever the definitions no longer call for. After generation, not before: the
  // generated set *is* the answer to what still belongs in this range.
  if (options?.regenFrom) {
    const stale = selectStaleDuties({
      stored: await db.duties.toArray(),
      expectedHashes: duties.map((duty) => duty.hash),
      from: options.regenFrom,
      to: endDate,
    });

    await Promise.all(stale.map((id) => documentSession.remove('duties', id)));
  }

  const newDuties: DBDuty[] = duties.map((duty) => ({
    ...duty,
    // The hash *is* the identity. It is a SHA-256 of expenseId, frequency and
    // execution date, so two devices generating the same window produce the same
    // row rather than two rows racing on the unique `hash` index — which is what
    // lets duties sync like any other table.
    id: duty.hash,
    createdAt: new Date(),
    executionDate: new Date(duty.executionDate),
  }));

  // 4. Insert new duties. Identity is the hash, so a duty this device already has
  // is skipped rather than duplicated; writing it again would also overwrite the
  // user's resolved/ignored marks.
  for (const duty of newDuties) {
    const exists = await db.duties.get(duty.id);

    if (!exists) {
      await documentSession.put('duties', duty);
    }
  }

  await setLastUpdated();

  // return refreshed list
  const allDuties = await db.duties.toArray();
  return allDuties;
}

/**
 * Generates the current month's duties, whether or not anybody has opened the Duties screen.
 *
 * Without this, duties exist only for ranges someone has looked at — generation used to hang
 * off that screen's own hook — while the overview reads the whole table to report what has
 * been paid this month. A device where the screen was never opened reported from nothing.
 *
 * Adds only, never sweeps: a sweep needs the full set of expenses to know what belongs, and a
 * deletion travels to the other device. Sweeping stays where the user is looking at a range.
 */
export async function topUpCurrentMonthDuties() {
  const today = new Date();

  await addDBDutiesForDateRange({ startDate: startOfMonth(today), endDate: endOfMonth(today) });
}

/**
 * Ticks or unticks an occurrence, and remembers a rejected match when there was one.
 *
 * Unticking something a transaction was matched to is a statement about the match, not
 * only about the tick: left as it was, the next import would find the same payment in the
 * same window and tick it straight back. One write, so a duty is never briefly unpaid but
 * still linked.
 *
 * `null` rather than `undefined` for the cleared link: the document codec skips undefined
 * values, so an undefined here would leave the old id in place and say nothing.
 */
export async function resolveDBDuty(id: string, resolved: boolean) {
  try {
    const duty = await db.duties.get(id);
    const rejectedMatch = !resolved && duty?.transactionId ? duty.transactionId : null;

    await documentSession.update('duties', id, {
      resolved,
      ...(rejectedMatch && {
        transactionId: null,
        rejectedTransactionIds: [...(duty?.rejectedTransactionIds ?? []), rejectedMatch],
      }),
    });
    await setLastUpdated();
    outbox.markDirty();
  } catch (e) {
    console.error(e);
  }
}

/**
 * Marks an occurrence as one that will not happen — or takes that back.
 *
 * This is what deleting a duty was reaching for and could not express. A duty's identity is
 * computed from its expense, so a deleted row is minted again the next time the range is
 * generated: absence says nothing, and the toast that reported success was wrong by the
 * next change of month. A mark on a row that stays is the only durable way to say it.
 */
export async function ignoreDBDuty(id: string, ignored: boolean) {
  try {
    await documentSession.update('duties', id, { ignored });
    await setLastUpdated();
    outbox.markDirty();
  } catch (e) {
    console.error(e);
  }
}
