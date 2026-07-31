import type { DBExpense } from '@/database/expenses.ts';
import type { DBDuty } from '@/database/duty.ts';
import { getDatesInRange } from '@/lib/dates.ts';
import { FREQUENCY } from '@/constant.ts';
import { hashString } from '@/lib/helpers.ts';

type CreateDutiesForSelectedDateRange = {
  expenses: DBExpense[];
  startDate: Date;
  endDate: Date;
};

type SelectStaleDuties = {
  stored: DBDuty[];
  expectedHashes: Iterable<string>;
  from: Date;
  to: Date;
};

/**
 * Which stored duties the current expense definitions would no longer produce.
 *
 * A duty's identity is `hash(expenseId, frequency, executionDate)`, so the honest question is
 * not "did the frequency change" but "is this row still in the set the expenses generate" —
 * the former cannot see a moved execution day, which is how one expense came to own two
 * occurrences in the same month.
 *
 * Bounded at both ends. Duties for months nobody opened on this device arrive by sync (ADR
 * 0001), so a sweep scoped to one range must leave every row outside it alone; unbounded, a
 * top-up of the current month would delete a future month generated elsewhere.
 *
 * A resolved duty is never returned. `resolved` is a user's decision rather than derived data,
 * so regeneration has no standing to destroy it — if an expense moved after a payment was
 * marked, both the payment and the new occurrence are true, and the user settles it by
 * skipping one.
 */
export function selectStaleDuties({ stored, expectedHashes, from, to }: SelectStaleDuties) {
  const expected = new Set(expectedHashes);

  return stored
    .filter((duty) => {
      const executionDate = new Date(duty.executionDate).getTime();
      const inRange = executionDate >= from.getTime() && executionDate <= to.getTime();

      return inRange && !expected.has(duty.hash) && !duty.resolved;
    })
    .map((duty) => duty.id);
}

async function generateDutyHash(
  executionDate: Date,
  expenseId: string,
  frequency: FREQUENCY
): Promise<string> {
  const valueToHash = `${expenseId}_${frequency}_${executionDate.toISOString()}`;
  return hashString(valueToHash);
}

type CreateDutiesForSelectedDateRangeResp = Pick<
  DBDuty,
  'executionDate' | 'expenseId' | 'frequency' | 'hash'
>;

export async function createDutiesForSelectedDateRange({
  expenses,
  startDate,
  endDate,
}: CreateDutiesForSelectedDateRange) {
  const dutiesForSelectedDateRange = new Set<CreateDutiesForSelectedDateRangeResp>();

  for (const expense of expenses) {
    if (!expense.execution) continue;

    switch (expense.frequency) {
      case FREQUENCY.DAILY: {
        const dates = getDatesInRange(startDate, endDate);
        for (const dateStr of dates) {
          const executionDate = new Date(dateStr);
          dutiesForSelectedDateRange.add({
            executionDate,
            expenseId: expense.id,
            frequency: expense.frequency,
            hash: await generateDutyHash(executionDate, expense.id, expense.frequency as FREQUENCY),
          });
        }
        break;
      }
      case FREQUENCY.WEEKLY: {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const executionDay = new Date(expense.execution).getDay();

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getDay() === executionDay) {
            dutiesForSelectedDateRange.add({
              frequency: expense.frequency,
              executionDate: new Date(d),
              expenseId: expense.id,
              hash: await generateDutyHash(new Date(d), expense.id, expense.frequency),
            });
          }
        }
        break;
      }
      case FREQUENCY.MONTHLY: {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const executionDate = new Date(expense.execution).getDate();

        for (
          let d = new Date(start.getFullYear(), start.getMonth(), executionDate);
          d <= end;
          d.setMonth(d.getMonth() + 1)
        ) {
          if (d >= start && d <= end) {
            dutiesForSelectedDateRange.add({
              frequency: expense.frequency,
              executionDate: new Date(d),
              expenseId: expense.id,
              hash: await generateDutyHash(new Date(d), expense.id, expense.frequency),
            });
          }
        }
        break;
      }
      case FREQUENCY.YEARLY: {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const execution = new Date(expense.execution);
        const executionMonth = execution.getMonth();
        const executionDay = execution.getDate();

        for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
          const dutyDate = new Date(year, executionMonth, executionDay);
          if (dutyDate >= start && dutyDate <= end) {
            dutiesForSelectedDateRange.add({
              frequency: expense.frequency,
              executionDate: dutyDate,
              expenseId: expense.id,
              hash: await generateDutyHash(dutyDate, expense.id, expense.frequency),
            });
          }
        }
        break;
      }
    }
  }

  return Array.from(dutiesForSelectedDateRange);
}
