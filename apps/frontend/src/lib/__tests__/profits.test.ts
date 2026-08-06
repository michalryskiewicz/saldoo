import { describe, expect, it } from 'vitest';
import { FREQUENCY } from '@/constant.ts';
import type { DBProfit } from '@/database/profits.ts';
import { groupProfitsByMonth, incomeBaseForMonth } from '../profits.ts';

const profit = (fields: Partial<DBProfit>): DBProfit =>
  ({
    id: 'a-profit',
    description: 'a profit',
    currency: 'PLN',
    profit: 0,
    ...fields,
  }) as DBProfit;

// A Wednesday in July 2026, which July holds five of and August four.
const WEDNESDAY_IN_JULY = new Date(2026, 6, 15);

describe('groupProfitsByMonth', () => {
  it('gives every month of the year, whether anything falls in it or not', () => {
    const months = groupProfitsByMonth([]);

    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ month: 0, total: 0 });
  });

  it('spreads a monthly profit across all twelve months', () => {
    const months = groupProfitsByMonth([
      profit({ profit: 12500, frequency: FREQUENCY.MONTHLY, execution: WEDNESDAY_IN_JULY }),
    ]);

    expect(months.map((month) => month.total)).toEqual(Array(12).fill(12500));
  });

  it('leaves a yearly profit in the one month it arrives in', () => {
    // The whole reason this exists: the overview counts a yearly profit in every month, which
    // reports a one-off commission of 3200 as 38 400 a year.
    const months = groupProfitsByMonth([
      profit({ profit: 3200, frequency: FREQUENCY.YEARLY, execution: WEDNESDAY_IN_JULY }),
    ]);

    expect(months[6].total).toBe(3200);
    expect(months.filter((month) => month.total > 0)).toHaveLength(1);
  });

  it('counts a weekly profit as often as its weekday falls in each month', () => {
    const months = groupProfitsByMonth([
      profit({ profit: 100, frequency: FREQUENCY.WEEKLY, execution: WEDNESDAY_IN_JULY }),
    ]);

    expect(months[6].total).toBe(500);
    expect(months[7].total).toBe(400);
  });

  it('counts a daily profit once per day of each month', () => {
    const months = groupProfitsByMonth([
      profit({ profit: 10, frequency: FREQUENCY.DAILY, execution: WEDNESDAY_IN_JULY }),
    ]);

    expect(months[6].total).toBe(310);
    // February 2026 has 28 days.
    expect(months[1].total).toBe(280);
  });

  it('adds up everything that lands in the same month', () => {
    const months = groupProfitsByMonth([
      profit({ profit: 12500, frequency: FREQUENCY.MONTHLY, execution: WEDNESDAY_IN_JULY }),
      profit({ profit: 3200, frequency: FREQUENCY.YEARLY, execution: WEDNESDAY_IN_JULY }),
    ]);

    expect(months[6].total).toBe(15700);
    expect(months[5].total).toBe(12500);
  });

  it('counts against the year being asked about, not the year the profit was entered in', () => {
    // Entered on a leap year's February. Asked about a year whose February is a day shorter —
    // the answer follows the question, or a profit entered in 2024 is counted against 2024's
    // calendar for the rest of its life.
    const months = groupProfitsByMonth(
      [profit({ profit: 10, frequency: FREQUENCY.DAILY, execution: new Date(2024, 1, 15) })],
      2027
    );

    expect(months[1].total).toBe(280);
  });

  it('stops arriving in the months after the series ended', () => {
    const months = groupProfitsByMonth(
      [
        profit({
          profit: 4000,
          frequency: FREQUENCY.MONTHLY,
          execution: new Date(2026, 0, 10),
          endsAt: new Date(2026, 2, 31),
        }),
      ],
      2026
    );

    expect(months.map((month) => month.total)).toEqual([4000, 4000, 4000, ...Array(9).fill(0)]);
  });

  it('leaves out a profit with no date rather than guessing one', () => {
    // A recurrence needs a day to recur on; without one there is no month to count it in.
    expect(groupProfitsByMonth([profit({ profit: 999, frequency: FREQUENCY.YEARLY })])).toEqual(
      groupProfitsByMonth([])
    );
  });
});

describe('incomeBaseForMonth', () => {
  const invoice = profit({
    id: 'client-a',
    profit: 10000,
    frequency: FREQUENCY.MONTHLY,
    execution: WEDNESDAY_IN_JULY,
  });
  const salary = profit({
    id: 'salary',
    profit: 7000,
    frequency: FREQUENCY.MONTHLY,
    execution: WEDNESDAY_IN_JULY,
  });

  it('adds up only the incomes it was pointed at', () => {
    const base = incomeBaseForMonth([invoice, salary], ['client-a'], { year: 2026, monthIndex: 6 });

    expect(base).toBe(10000);
  });

  it('counts a named income as often as it actually arrives in that month', () => {
    const quarterly = profit({
      id: 'commission',
      profit: 3200,
      frequency: FREQUENCY.YEARLY,
      execution: WEDNESDAY_IN_JULY,
    });
    const month = (monthIndex: number) => incomeBaseForMonth([quarterly], ['commission'], { year: 2026, monthIndex });

    expect(month(6)).toBe(3200);
    expect(month(7)).toBe(0);
  });

  it('finds nothing for an income that is no longer there', () => {
    expect(incomeBaseForMonth([invoice], ['deleted'], { year: 2026, monthIndex: 6 })).toBe(0);
  });
});
