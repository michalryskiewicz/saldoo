import type { FREQUENCY } from '@/constant.ts';
import { db } from '@/database/index';
import type { DBExpense } from '@/database/expenses';
import { v4 as uuidv4 } from 'uuid';
import { getExpensesInSelectedDateRange } from '@/lib/expenses.ts';
import { createDutiesForSelectedDateRange } from '@/database/services/duties.service.ts';
import { vaultDriveSync } from '@/database/sync/sync.container.ts';
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

// New options:
// - regenFrom: if provided, delete existing duties for affected expenses with executionDate >= regenFrom before inserting new ones.
// - keepResolved: when regenFrom is provided, keep duties that are already resolved (default: false)
type AddDBDutiesOptions = {
  regenFrom?: Date | null;
  keepResolved?: boolean;
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

  // If caller requested regeneration from a specific date, remove existing future duties
  if (options?.regenFrom) {
    const regenFrom = options.regenFrom;
    const keepResolved = !!options.keepResolved;
    const expenseIds = expensesThatShouldBeExecuted.map((e) => e.id);

    if (expenseIds.length > 0) {
      // build a map of current expense frequencies to compare with duties
      const freqByExpenseId = new Map<string | undefined, FREQUENCY | undefined>(
        expensesThatShouldBeExecuted.map((e) => [e.id, e.frequency])
      );

      // load candidate duties for those expenses, then filter by executionDate, resolved flag and frequency change
      const candidateDuties = await db.duties.where('expenseId').anyOf(expenseIds).toArray();

      const dutiesToDelete = candidateDuties
        .filter((d) => {
          const execDate = new Date(d.executionDate);
          const isOnOrAfter = execDate >= regenFrom;
          const isUnresolved = !d.resolved;
          // compare duty frequency with current expense frequency
          const expenseFreq = freqByExpenseId.get(d.expenseId ?? '');
          const freqDifferent = expenseFreq !== d.frequency;
          // delete when on/after regenFrom, frequency changed, and either not keeping resolved or duty is unresolved
          return isOnOrAfter && freqDifferent && (keepResolved ? true : isUnresolved);
        })
        .map((d) => d.id);

      if (dutiesToDelete.length > 0) {
        await Promise.all(dutiesToDelete.map((id) => db.duties.delete(id)));
      }
    }
  }

  // 3. Generate new duties
  const duties = await createDutiesForSelectedDateRange({
    expenses: expensesThatShouldBeExecuted,
    startDate,
    endDate,
  });

  const newDuties: DBDuty[] = duties.map((duty) => ({
    ...duty,
    id: uuidv4(),
    createdAt: new Date(),
    executionDate: new Date(duty.executionDate),
  }));

  // 4. Insert new duties, skipping duplicates using hash
  for (const duty of newDuties) {
    const exists = await db.duties.where({ hash: duty.hash }).first();

    if (!exists) {
      await db.duties.add(duty);
    }
  }

  await setLastUpdated();

  // return refreshed list
  const allDuties = await db.duties.toArray();
  return allDuties;
}

export async function resolveDBDuty(id: string, resolved: boolean) {
  try {
    await db.duties.update(id, { resolved });
    await setLastUpdated();
    await vaultDriveSync.exportToDrive();
  } catch (e) {
    console.error(e);
  }
}

export async function deleteDBDuty(id: string) {
  try {
    await db.duties.delete(id);
    await setLastUpdated();
    await vaultDriveSync.exportToDrive();
    toast(i18n.t('success.deleted-duty'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.deleted-duty'));
  }
}
