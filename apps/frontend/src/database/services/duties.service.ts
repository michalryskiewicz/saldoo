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
  keepResolved: boolean;
};

export function selectStaleDuties({
  stored,
  expectedHashes,
  from,
  to,
  keepResolved,
}: SelectStaleDuties) {
  const expected = new Set(expectedHashes);

  return stored
    .filter((duty) => {
      const executionDate = new Date(duty.executionDate).getTime();
      const inRange = executionDate >= from.getTime() && executionDate <= to.getTime();
      const isProtected = keepResolved && !!duty.resolved;

      return inRange && !expected.has(duty.hash) && !isProtected;
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
