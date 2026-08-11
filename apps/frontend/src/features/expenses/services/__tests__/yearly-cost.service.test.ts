import { describe, expect, it } from 'vitest';
import type { DBExpense } from '@/database/expenses.ts';
import type { MaybeConverted } from '@/lib/exchange-rate.ts';
import { yearlyCostOrigin, yearlyIncomeOrigin } from '../yearly-cost.service.ts';

const monthly = (
  expense: number,
  convertedFrom?: { amount: number; currency: 'PLN' | 'EUR' }
): MaybeConverted<DBExpense> =>
  ({
    id: 'e1',
    createdAt: new Date('2026-01-01'),
    description: 'Prąd',
    expense,
    currency: 'EUR',
    frequency: 'MONTHLY',
    execution: new Date('2026-01-10'),
    convertedFrom,
  }) as never;

describe('yearlyCostOrigin', () => {
  /**
   * The yearly column is a multiple of the converted amount, so it cannot borrow the monthly
   * original's mark: naming 45 zł beside a figure of twelve times that would be a lie about the
   * very thing the mark exists to be honest about. It gets its own, run through the same
   * arithmetic on the original.
   */
  it('is the yearly cost as it would read in the original currency', () => {
    const origin = yearlyCostOrigin(monthly(10, { amount: 45, currency: 'PLN' }), [], 2026);

    expect(origin).toEqual({ amount: 540, currency: 'PLN' });
  });

  it('is nothing where the amount was never converted', () => {
    expect(yearlyCostOrigin(monthly(10), [], 2026)).toBeUndefined();
  });

  /**
   * A cost that is a share of an income has no amount of its own — `expense` is nought — so its
   * yearly figure comes from the incomes, which were converted separately. There is no original of
   * this figure to name, and a mark quoting nought would be worse than no mark.
   */
  it('is nothing for a cost that is a share of an income', () => {
    const share = {
      ...monthly(0, { amount: 0, currency: 'PLN' }),
      percentageOfIncome: { percent: 12, profitIds: ['p1'] },
    } as never;

    expect(yearlyCostOrigin(share, [], 2026)).toBeUndefined();
  });
});

describe('yearlyIncomeOrigin', () => {
  const salary = (profit: number, convertedFrom?: { amount: number; currency: 'PLN' }) =>
    ({
      id: 'p1',
      createdAt: new Date('2026-01-01'),
      description: 'Wynagrodzenie',
      profit,
      currency: 'EUR',
      frequency: 'MONTHLY',
      execution: new Date('2026-01-10'),
      convertedFrom,
    }) as never;

  it('is the yearly income as it would read in the original currency', () => {
    expect(yearlyIncomeOrigin(salary(1000, { amount: 4500, currency: 'PLN' }), 2026)).toEqual({
      amount: 54000,
      currency: 'PLN',
    });
  });

  it('is nothing where the amount was never converted', () => {
    expect(yearlyIncomeOrigin(salary(1000), 2026)).toBeUndefined();
  });
});
