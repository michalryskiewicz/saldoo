import type { DBExpense } from '@/database/expenses.ts';
import type { DBDuty } from '@/database/duty.ts';
import { daysInMonth, getDatesInRange } from '@/lib/dates.ts';
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
 * A duty the user has marked is never returned. `resolved` and `ignored` are decisions rather
 * than derived data (ADR 0001), so regeneration has no standing to destroy either — if an
 * expense moved after a payment was marked, both the payment and the new occurrence are true,
 * and the user settles that by skipping one.
 */
export function selectStaleDuties({ stored, expectedHashes, from, to }: SelectStaleDuties) {
  const expected = new Set(expectedHashes);

  return stored
    .filter((duty) => {
      const executionDate = new Date(duty.executionDate).getTime();
      const inRange = executionDate >= from.getTime() && executionDate <= to.getTime();

      return inRange && !expected.has(duty.hash) && !duty.resolved && !duty.ignored;
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
        const dayOfMonth = new Date(expense.execution).getDate();

        // Walked from the first of each month and the day clamped to what that month has, rather
        // than built directly from the day. A cost due on the 31st built as `new Date(y, 1, 31)`
        // is the 3rd of March, which is past the end of February — so the loop never ran and the
        // month simply had no such cost in it. Rent due on the 31st was missing from five months
        // of the year, and nothing said so.
        for (
          let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
          cursor <= end;
          cursor.setMonth(cursor.getMonth() + 1)
        ) {
          const d = new Date(
            cursor.getFullYear(),
            cursor.getMonth(),
            Math.min(dayOfMonth, daysInMonth(cursor.getFullYear(), cursor.getMonth()))
          );

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
