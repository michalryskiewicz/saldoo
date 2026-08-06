import { describe, it, expect } from 'vitest';
import { survivesIncomeLoss } from '../safety-net';
import type { DBExpense } from '@/database/expenses.ts';
import { SEVERITY } from '@/constant.ts';

describe('survivesIncomeLoss', () => {
  const expense = (fields: Partial<DBExpense>) => fields as DBExpense;

  it('takes the answer from the expense when it has one', () => {
    expect(survivesIncomeLoss(expense({ survivesIncomeLoss: false }))).toBe(false);
  });

  it('reads an unanswered low-priority cost as one that goes', () => {
    expect(survivesIncomeLoss(expense({ severity: SEVERITY.LOW }))).toBe(false);
  });

  it('lets an answer overrule the priority it was once given', () => {
    expect(survivesIncomeLoss(expense({ severity: SEVERITY.LOW, survivesIncomeLoss: true }))).toBe(
      true
    );
  });

  it('keeps an unanswered cost in the fund, because too small a fund is the worse mistake', () => {
    expect(survivesIncomeLoss(expense({ severity: null }))).toBe(true);
    expect(survivesIncomeLoss(expense({ severity: SEVERITY.MEDIUM }))).toBe(true);
    expect(survivesIncomeLoss(expense({ severity: SEVERITY.HIGH }))).toBe(true);
  });

  /**
   * A share of an income is zero when there is no income, so it cannot be something the fund has
   * to cover. The fund is worked out from *planned* income, though, which is exactly why the app
   * cannot be left to notice this on its own.
   */
  it('never counts a share of an income, whatever anybody answered about it', () => {
    const tax: Partial<DBExpense> = {
      percentageOfIncome: { percent: 12, profitIds: ['client-a'], basePeriod: 'previousMonth' },
    };

    expect(survivesIncomeLoss(expense({ ...tax }))).toBe(false);
    expect(survivesIncomeLoss(expense({ ...tax, severity: SEVERITY.HIGH }))).toBe(false);
    expect(survivesIncomeLoss(expense({ ...tax, survivesIncomeLoss: true }))).toBe(false);
  });
});
