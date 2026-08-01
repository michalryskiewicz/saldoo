import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  groupExpensesAndProfitsByMonth,
  groupExpensesByCategory,
  groupExpensesByMonth,
  groupExpensesByStrategyPart,
} from '../expenses';
import { countWeekdaysInMonth, daysInMonth, MONTHS } from '../dates';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBTransaction } from '@/database/transactions.ts';
import type { DBDuty } from '@/database/duty.ts';
import type { Currency } from '@/constant.ts';

describe('expenses service', () => {
  // These groupers resolve WEEKLY/DAILY occurrence counts against the *current*
  // year, so any fixture with a fixed date needs the clock pinned to match.
  const freezeClock = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('groupExpensesByMonth', () => {
    it('ignores expenses with missing severity and add it only to total severity bucket', () => {
      const data = [
        {
          execution: '2024-06-10',
          expense: 40,
          severity: undefined,
          frequency: 'YEARLY',
        },
        {
          execution: '2024-06-15',
          expense: 20,
          severity: 'LOW',
          frequency: 'YEARLY',
        },
      ] as never[];
      const juneIdx = MONTHS.indexOf('June');
      const result = groupExpensesByMonth(data);
      expect(result.find((m) => m.month === juneIdx)?.low).toEqual(20);
      expect(result.find((m) => m.month === juneIdx)?.high).toBe(0);
      expect(result.find((m) => m.month === juneIdx)?.medium).toBe(0);
      expect(result.find((m) => m.month === juneIdx)?.total).toBe(60);
    });

    it('handles expenses with invalid execution date by skipping them', () => {
      const data = [
        {
          execution: 'not-a-date',
          expense: 60,
          severity: 'HIGH',
          frequency: 'YEARLY',
        },
        {
          execution: '2024-07-10',
          expense: 30.01,
          severity: 'MEDIUM',
          frequency: 'YEARLY',
        },
      ] as never[];
      const julyIdx = MONTHS.indexOf('July');
      const result = groupExpensesByMonth(data);
      expect(result.find((m) => m.month === julyIdx)?.medium).toBe(30.01);
      expect(result.find((m) => m.month === julyIdx)?.high).toBe(0);
      expect(result.find((m) => m.month === julyIdx)?.total).toBe(30.01);
    });

    it('returns all months with zero values when input is empty', () => {
      const result = groupExpensesByMonth([]);
      expect(result).toHaveLength(12);
      expect(
        result.every((m) => m.total === 0 && m.high === 0 && m.medium === 0 && m.low === 0)
      ).toBe(true);
    });

    it('correctly sums up monthly frequency expenses for all months', () => {
      const data = [
        {
          execution: '2024-01-01',
          expense: 10,
          severity: 'HIGH',
          frequency: 'MONTHLY',
        },
      ] as never[];
      const result = groupExpensesByMonth(data);
      result.forEach((m) => {
        expect(m.high).toBe(10);
        expect(m.total).toBe(10);
      });
    });

    it('correctly multiplies weekly frequency expenses by weekday count in each month', () => {
      // Pinned, because the count is taken against the year on display rather than the year the
      // cost was entered in: how many Mondays January holds is a property of the year being read.
      freezeClock('2024-06-15');
      const data = [
        {
          execution: '2024-01-01',
          expense: 5,
          severity: 'MEDIUM',
          frequency: 'WEEKLY',
        },
      ] as never[];
      const result = groupExpensesByMonth(data);
      // 2024-01-01 is a Monday, so count Mondays in each month
      const janIdx = MONTHS.indexOf('January');
      expect(result.find((m) => m.month === janIdx)?.medium).toBe(
        Number((countWeekdaysInMonth(2024, 0, 1) * 5)?.toFixed(2))
      );
    });

    it('correctly multiplies daily frequency expenses by days in each month', () => {
      // 2024 is a leap year and the fixture leans on it: February is 29 days here and 28 in most
      // others, which is the whole reason the year cannot come off the execution date.
      freezeClock('2024-06-15');
      const data = [
        {
          execution: '2024-02-01',
          expense: 2,
          severity: 'LOW',
          frequency: 'DAILY',
        },
      ] as never[];
      const febIdx = MONTHS.indexOf('February');
      const result = groupExpensesByMonth(data);
      expect(result.find((m) => m.month === febIdx)?.low).toBe(
        Number((daysInMonth(2024, 1) * 2)?.toFixed(2))
      );
    });
  });

  describe('groupExpensesAndProfitsByMonth', () => {
    it('returns all months with zero values when both expenses and profits are empty', () => {
      const result = groupExpensesAndProfitsByMonth([], []);
      expect(result).toHaveLength(12);
      expect(result.every((m) => m.totalExpense === 0 && m.totalProfits === 0)).toBe(true);
    });

    it('correctly sums yearly, monthly, weekly, and daily expenses into each month', () => {
      const expenses = [
        { expense: 10, frequency: 'YEARLY', execution: '2024-03-01' },
        { expense: 5, frequency: 'MONTHLY' },
        { expense: 2, frequency: 'WEEKLY', execution: '2024-01-01' },
        { expense: 1, frequency: 'DAILY', execution: '2024-01-01' },
      ] as never[];
      const profits: never[] = [];
      const result = groupExpensesAndProfitsByMonth(expenses, profits);
      expect(result).toHaveLength(12);
      // March should include yearly, monthly, weekly, and daily
      expect(result[2].totalExpense).toBeGreaterThan(0);
      // All months should include monthly, weekly, and daily
      expect(result.every((m) => m.totalExpense > 0)).toBe(true);
    });

    it('correctly sums monthly profits into every month', () => {
      const profits = [
        { profit: 100, frequency: 'MONTHLY', execution: new Date(2026, 6, 15) },
        { profit: 50, frequency: 'MONTHLY', execution: new Date(2026, 6, 15) },
      ] as never[];
      const result = groupExpensesAndProfitsByMonth([], profits);
      expect(result).toHaveLength(12);
      result.forEach((m) => {
        expect(m.totalProfits).toBe(150);
      });
    });

    it('leaves a yearly profit in the month it arrives in', () => {
      // It used to land in all twelve, whatever its frequency, so a one-off commission of 3200
      // was reported as 38 400 a year -- and the profit line across the overview was flat.
      const profits = [
        { profit: 3200, frequency: 'YEARLY', execution: new Date(2026, 6, 15) },
      ] as never[];
      const result = groupExpensesAndProfitsByMonth([], profits);

      expect(result[6].totalProfits).toBe(3200);
      expect(result.filter((m) => m.totalProfits > 0)).toHaveLength(1);
    });

    it('handles expenses with missing execution date by skipping them', () => {
      const expenses = [
        { expense: 10, frequency: 'YEARLY' },
        { expense: 5, frequency: 'WEEKLY' },
        { expense: 2, frequency: 'DAILY' },
        { expense: 3, frequency: 'MONTHLY' },
      ] as never[];
      const result = groupExpensesAndProfitsByMonth(expenses, []);
      // Only monthly should be counted for all months
      result.forEach((m) => {
        expect(m.totalExpense).toBe(3);
      });
    });

    it('handles invalid execution date gracefully', () => {
      const expenses = [
        { expense: 10, frequency: 'YEARLY', execution: 'not-a-date' },
        { expense: 5, frequency: 'WEEKLY', execution: 'not-a-date' },
        { expense: 2, frequency: 'DAILY', execution: 'not-a-date' },
        { expense: 3, frequency: 'MONTHLY' },
      ] as never[];
      const result = groupExpensesAndProfitsByMonth(expenses, []);
      // Only monthly should be counted for all months
      result.forEach((m) => {
        expect(m.totalExpense).toBe(3);
      });
    });
  });

  describe('groupExpensesByCategory', () => {
    it('returns empty array when input data is empty', () => {
      const result = groupExpensesByCategory(0, []);
      expect(result).toEqual([]);
    });

    it('groups monthly expenses by tag for the given month', () => {
      const data = [
        { expense: 10, frequency: 'MONTHLY', tag: { name: 'Food' } },
        { expense: 20, frequency: 'MONTHLY', tag: { name: 'Transport' } },
        { expense: 5, frequency: 'MONTHLY', tag: { name: 'Food' } },
      ] as never[];
      const result = groupExpensesByCategory(0, data);
      expect(result).toContainEqual({ tag: 'Food', total: 15 });
      expect(result).toContainEqual({ tag: 'Transport', total: 20 });
    });

    it('includes only yearly expenses for the selected month', () => {
      const data = [
        {
          expense: 50,
          frequency: 'YEARLY',
          execution: '2024-03-01',
          tag: { name: 'Bills' },
        },
        {
          expense: 30,
          frequency: 'YEARLY',
          execution: '2024-04-01',
          tag: { name: 'Bills' },
        },
      ] as never[];
      const marchIdx = MONTHS.indexOf('March');
      const aprilIdx = MONTHS.indexOf('April');
      const marchResult = groupExpensesByCategory(marchIdx, data);
      expect(marchResult).toContainEqual({ tag: 'Bills', total: 50 });
      const aprilResult = groupExpensesByCategory(aprilIdx, data);
      expect(aprilResult).toContainEqual({ tag: 'Bills', total: 30 });
    });

    it('correctly multiplies weekly frequency expenses by weekday count in the month', () => {
      const year = 2020;
      freezeClock(`${year}-01-15`);
      const janIdx = MONTHS.indexOf('January');
      const data = [
        {
          expense: 7,
          frequency: 'WEEKLY',
          execution: `${year}-01-01`,
          tag: { name: 'Gym' },
        },
      ] as never[];
      const result = groupExpensesByCategory(janIdx, data);

      const wednesdaysInJanuary2020 = 5;
      expect(result).toContainEqual({
        tag: 'Gym',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        total: Number(wednesdaysInJanuary2020 * data[0].expense),
      });
    });

    it('correctly multiplies daily frequency expenses by days in the month', () => {
      const year = new Date().getFullYear();
      const febIdx = MONTHS.indexOf('February');
      const data = [
        {
          expense: 2,
          frequency: 'DAILY',
          execution: `${year}-02-01`,
          tag: { name: 'Coffee' },
        },
      ] as never[];
      const expected = 2 * daysInMonth(year, febIdx);
      const result = groupExpensesByCategory(febIdx, data);
      expect(result).toContainEqual({
        tag: 'Coffee',
        total: Number(expected.toFixed(2)),
      });
    });

    it('ignores expenses without a tag', () => {
      const data = [
        { expense: 10, frequency: 'MONTHLY' },
        { expense: 20, frequency: 'MONTHLY', tag: { name: 'Food' } },
      ] as never[];
      const result = groupExpensesByCategory(0, data);
      expect(result).toHaveLength(1);
      expect(result[0].tag).toBe('Food');
    });

    it('skips yearly, weekly, and daily expenses with missing execution date', () => {
      const data = [
        { expense: 10, frequency: 'YEARLY', tag: { name: 'Bills' } },
        { expense: 5, frequency: 'WEEKLY', tag: { name: 'Bills' } },
        { expense: 2, frequency: 'DAILY', tag: { name: 'Bills' } },
        { expense: 3, frequency: 'MONTHLY', tag: { name: 'Bills' } },
      ] as never[];
      const result = groupExpensesByCategory(0, data);
      expect(result).toContainEqual({ tag: 'Bills', total: 3 });
      expect(result).toHaveLength(1);
    });

    it('returns empty array if no expenses match the selected month', () => {
      const data = [
        {
          expense: 10,
          frequency: 'YEARLY',
          execution: '2024-05-01',
          tag: { name: 'Bills' },
        },
      ] as never[];
      const janIdx = MONTHS.indexOf('January');
      const result = groupExpensesByCategory(janIdx, data);
      expect(result).toEqual([]);
    });
  });

  describe('groupExpensesByStrategyPart', () => {
    it('returns correct planned and real totals for monthly and yearly expenses', () => {
      const month = 9; // October (0-based)
      freezeClock('2025-10-15');
      const expenses = [
        {
          strategyPart: 'NEEDS',
          execution: '2025-10-10',
          expense: 100,
          frequency: 'MONTHLY',
        },
        {
          strategyPart: 'WANTS',
          execution: '2025-10-10',
          expense: 200,
          frequency: 'YEARLY',
        },
        {
          strategyPart: 'NEEDS',
          execution: '2025-09-10',
          expense: 50,
          frequency: 'YEARLY',
        },
      ] as unknown as DBExpense[];
      const transactions = [
        {
          strategyPart: 'NEEDS',
          transactionDate: '2025-10-15',
          amount: -80,
        },
        {
          strategyPart: 'WANTS',
          transactionDate: '2025-10-20',
          amount: -150,
        },
        {
          strategyPart: 'NEEDS',
          transactionDate: '2025-09-15',
          amount: -30,
        },
      ] as unknown as DBTransaction[];
      const duties = [
        {
          price: 20,
          currency: 'EUR',
          expense: { strategyPart: 'NEEDS', expense: 20 },
          executionDate: '2025-10-05',
          resolved: true,
        },
        {
          price: 10,
          currency: 'EUR',
          expense: { strategyPart: 'WANTS', expense: 10 },
          executionDate: '2025-10-07',
          resolved: false,
        },
      ] as unknown as (DBDuty & { price: number; currency: Currency })[];
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const result = groupExpensesByStrategyPart(month, expenses, transactions, duties);
      expect(result.find((r) => r.strategyPart === 'NEEDS')?.planned).toBe(100);
      expect(result.find((r) => r.strategyPart === 'NEEDS')?.real).toBe(100);
      expect(result.find((r) => r.strategyPart === 'WANTS')?.planned).toBe(200);
      expect(result.find((r) => r.strategyPart === 'WANTS')?.real).toBe(150);
    });

    it('returns zero totals when no matching strategyPart exists', () => {
      const result = groupExpensesByStrategyPart(9, [], [], []);
      expect(result).toEqual([]);
    });

    it('ignores duties that are not resolved or have transactionId', () => {
      const month = 9;
      freezeClock('2025-10-15');
      const duties = [
        {
          price: 30,
          currency: 'EUR',
          expense: { strategyPart: 'NEEDS', expense: 30 },
          executionDate: '2025-10-10',
          resolved: false,
          transactionId: 'tx1',
        },
      ] as unknown as (DBDuty & { price: number; currency: Currency })[];
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const result = groupExpensesByStrategyPart(month, [], [], duties);
      expect(result.find((r) => r.strategyPart === 'NEEDS')?.real).toEqual(undefined);
    });

    it('handles edge case with missing strategyPart in expenses, transactions, and duties', () => {
      const month = 9;
      freezeClock('2025-10-15');
      const expenses = [
        { execution: '2025-10-10', expense: 100, frequency: 'MONTHLY' },
      ] as unknown as DBExpense[];
      const transactions = [{ transactionDate: '2025-10-15', amount: -80 }] as never[];
      const duties = [
        { price: 20, currency: 'EUR', executionDate: '2025-10-05', resolved: true },
      ] as never[];
      const result = groupExpensesByStrategyPart(month, expenses, transactions, duties);
      expect(result).toEqual([]);
    });

    it('handles weekly and daily frequency correctly for planned totals', () => {
      const month = 9;
      const year = 2025;
      const weekday = 0; // Sunday
      const expenses = [
        {
          strategyPart: 'NEEDS',
          execution: new Date(year, month, 5),
          expense: 10,
          frequency: 'WEEKLY',
        },
        {
          strategyPart: 'WANTS',
          execution: new Date(year, month, 1),
          expense: 2,
          frequency: 'DAILY',
        },
      ] as never[];
      const result = groupExpensesByStrategyPart(month, expenses, [], []);
      const sundays = countWeekdaysInMonth(year, month, weekday);
      const days = daysInMonth(year, month);
      expect(result.find((r) => r.strategyPart === 'NEEDS')?.planned).toBe(10 * sundays);
      expect(result.find((r) => r.strategyPart === 'WANTS')?.planned).toBe(2 * days);
    });
  });
});
