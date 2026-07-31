import type { FREQUENCY } from '@/constant.ts';
import { db } from '@/database/index';
import type { DBExpense } from '@/database/expenses';
import { getExpensesInSelectedDateRange } from '@/lib/expenses.ts';
import {
  createDutiesForSelectedDateRange,
  selectStaleDuties,
} from '@/database/services/duties.service.ts';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { toast } from 'sonner';
import i18n from '@/i18n.ts';
import { setLastUpdated } from '@/database/meta.ts';

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
  transactionId?: string;
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

export async function resolveDBDuty(id: string, resolved: boolean) {
  try {
    await documentSession.update('duties', id, { resolved });
    await setLastUpdated();
    outbox.markDirty();
  } catch (e) {
    console.error(e);
  }
}

export async function deleteDBDuty(id: string) {
  try {
    await documentSession.remove('duties', id);
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.deleted-duty'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.deleted-duty'));
  }
}
