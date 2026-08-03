import { describe, expect, it } from 'vitest';
import { FREQUENCY } from '@/constant.ts';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBProfit } from '@/database/profits.ts';
import { expenseAmountForMonth, expenseCostInYear } from '../expense-amount.ts';

const expense = (fields: Partial<DBExpense>): DBExpense => fields as DBExpense;

const invoice = {
  id: 'client-a',
  profit: 10000,
  frequency: FREQUENCY.MONTHLY,
  execution: new Date(2026, 0, 10),
} as DBProfit;

describe('expenseAmountForMonth', () => {
  it('gives back the amount that was typed, when one was', () => {
    const rent = expense({ expense: 2500 });

    expect(expenseAmountForMonth(rent, [], { year: 2026, monthIndex: 6 })).toBe(2500);
  });

  /**
   * The flat-rate tax, as it actually falls: an invoice on the 10th of March, 12% of it paid to
   * the tax office by the 20th of April. April's own invoice has nothing to do with April's tax.
   */
  it('takes its share of the month before, when that is the base period', () => {
    const tax = expense({
      expense: 0,
      percentageOfIncome: { percent: 12, profitIds: ['client-a'], basePeriod: 'previousMonth' },
    });

    expect(expenseAmountForMonth(tax, [invoice], { year: 2026, monthIndex: 3 })).toBe(1200);
  });
});

describe('expenseCostInYear', () => {
  it('adds up a fixed cost the way the recurrence engine always did', () => {
    const rent = expense({
      expense: 2500,
      frequency: FREQUENCY.MONTHLY,
      execution: new Date(2026, 0, 10),
    });

    expect(expenseCostInYear(rent, [], 2026)).toBe(30000);
  });

  /**
   * A share cannot be added up by multiplying one amount by twelve, which is what a yearly total
   * used to be: the base is a different figure in every month, and eleven of them are zero here.
   */
  it('adds up a share month by month, because each month has its own base', () => {
    const yearlyInvoice = {
      id: 'client-a',
      profit: 10000,
      frequency: FREQUENCY.YEARLY,
      execution: new Date(2026, 2, 10),
    } as DBProfit;
    const tax = expense({
      expense: 0,
      frequency: FREQUENCY.MONTHLY,
      execution: new Date(2026, 0, 20),
      percentageOfIncome: { percent: 12, profitIds: ['client-a'], basePeriod: 'previousMonth' },
    });

    expect(expenseCostInYear(tax, [yearlyInvoice], 2026)).toBe(1200);
  });
});
