import { describe, expect, it } from 'vitest';
import { FREQUENCY } from '@/constant.ts';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBProfit } from '@/database/profits.ts';
import { endsWithItsIncome, hasLostItsBase } from '../percentage-of-income.ts';

const expense = (fields: Partial<DBExpense>): DBExpense => fields as DBExpense;

const income = (fields: Partial<DBProfit>): DBProfit =>
  ({
    id: 'client-a',
    profit: 10000,
    frequency: FREQUENCY.MONTHLY,
    execution: new Date(2026, 0, 10),
    ...fields,
  }) as DBProfit;

const taxOn = (profitIds: string[], basePeriod: 'thisMonth' | 'previousMonth' = 'previousMonth') =>
  expense({ percentageOfIncome: { percent: 12, profitIds, basePeriod } });

describe('endsWithItsIncome', () => {
  it('has nothing to say about a cost that is not a share of anything', () => {
    expect(endsWithItsIncome(expense({ expense: 2500 }), [])).toBeUndefined();
  });

  it('has nothing to say while the income goes on', () => {
    expect(endsWithItsIncome(taxOn(['client-a']), [income({})])).toBeUndefined();
  });

  /**
   * The client leaves in March and the last invoice is a March one, so the last tax on it is due
   * in April. Not the 10th of April — the whole month of April, because the tax has its own day
   * and cutting the series at the invoice's day of the month would drop the occurrence it exists
   * to cover.
   */
  it('ends the month after the last invoice, when the share is of the month before', () => {
    const ended = income({ endsAt: new Date(2026, 2, 10) });

    expect(endsWithItsIncome(taxOn(['client-a']), [ended])).toEqual(
      new Date(2026, 3, 30, 23, 59, 59, 999)
    );
  });

  it('ends with the invoice itself, when the share is of the same month', () => {
    const ended = income({ endsAt: new Date(2026, 2, 10) });

    expect(endsWithItsIncome(taxOn(['client-a'], 'thisMonth'), [ended])).toEqual(
      new Date(2026, 2, 31, 23, 59, 59, 999)
    );
  });

  it('waits for the last of them when the share is of several incomes', () => {
    const first = income({ id: 'client-a', endsAt: new Date(2026, 2, 10) });
    const later = income({ id: 'client-b', endsAt: new Date(2026, 5, 10) });

    expect(endsWithItsIncome(taxOn(['client-a', 'client-b']), [first, later])).toEqual(
      new Date(2026, 6, 31, 23, 59, 59, 999)
    );
  });

  it('says nothing while any one of them is still running', () => {
    const ended = income({ id: 'client-a', endsAt: new Date(2026, 2, 10) });
    const running = income({ id: 'client-b' });

    expect(endsWithItsIncome(taxOn(['client-a', 'client-b']), [ended, running])).toBeUndefined();
  });
});

describe('hasLostItsBase', () => {
  it('is never true of a cost that is not a share of anything', () => {
    expect(hasLostItsBase(expense({ expense: 2500 }), [])).toBe(false);
  });

  /**
   * A deleted income and an ended one are different situations. An ended one is still there to be
   * found, so the cost inherits its ending and keeps its history; a deleted one leaves no date to
   * inherit, and computing 12% of nothing would report a cost of zero as though that were the
   * answer — the failure this exists to prevent.
   */
  it('is true when the income it is a share of is gone', () => {
    expect(hasLostItsBase(taxOn(['client-a']), [])).toBe(true);
    expect(hasLostItsBase(taxOn(['client-a']), [income({ id: 'someone-else' })])).toBe(true);
  });

  it('is false while any of its incomes is still there, ended or not', () => {
    expect(hasLostItsBase(taxOn(['client-a']), [income({ endsAt: new Date(2026, 2, 10) })])).toBe(
      false
    );
    expect(
      hasLostItsBase(taxOn(['client-a', 'client-b']), [income({ id: 'client-b' })])
    ).toBe(false);
  });
});
