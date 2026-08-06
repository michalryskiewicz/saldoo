import { describe, expect, it } from 'vitest';
import { FREQUENCY, STRATEGY_PART } from '@/constant.ts';
import type { DBExpense } from '@/database/expenses.ts';
import { goalDraftFromExpense, lastDayItIsStillACost } from '../expense-to-goal.service.ts';

const APRIL_2026 = new Date(2026, 3, 15);

const ike = {
  id: 'e1',
  description: 'IKE',
  expense: 2500,
  currency: 'PLN',
  strategyPart: STRATEGY_PART.LONG_TERM_SAVINGS,
  frequency: FREQUENCY.MONTHLY,
  execution: new Date(2026, 0, 10),
} as DBExpense;

describe('goalDraftFromExpense', () => {
  /**
   * A recurring cost has a rate, not a target, so the target is a year of it — which is also what
   * makes the goal comparable with the expense it replaces on the strategy tile.
   */
  it('carries the name, the part, and a year of the cost as the target', () => {
    const draft = goalDraftFromExpense(ike, [], APRIL_2026);

    expect(draft.description).toBe('IKE');
    expect(draft.strategyPart).toBe(STRATEGY_PART.LONG_TERM_SAVINGS);
    expect(draft.target).toBe(30000);
  });

  it('rolls yearly, because a cost that repeats is a commitment that repeats', () => {
    const draft = goalDraftFromExpense(ike, [], APRIL_2026);

    expect(draft.year).toBe(2026);
    expect(draft.deadline).toEqual(new Date(2026, 11, 31));
  });

  /**
   * Whether the money stays yours is the one thing the app cannot work out, and getting it wrong
   * changes what the lifetime figure *means* — how much you put through this, against how much you
   * hold. So it is left unanswered for the person to say.
   */
  it('does not decide whether the money stays yours', () => {
    expect(goalDraftFromExpense(ike, [], APRIL_2026).keepsItsMoney).toBeUndefined();
  });
});

describe('lastDayItIsStillACost', () => {
  /**
   * The end of the month it is converted in, not today. Ending it mid-month would drop occurrences
   * the person may already have paid, and #70 is explicit that ending a series keeps everything up
   * to the ending day exactly as it was.
   */
  it('lets the month it is converted in finish', () => {
    expect(lastDayItIsStillACost(APRIL_2026)).toEqual(new Date(2026, 3, 30));
  });
});
