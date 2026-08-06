import { describe, expect, it } from 'vitest';
import { STRATEGY_PART } from '@/constant.ts';
import type { DBGoal } from '@/database/goals.ts';
import type { DBContribution } from '@/database/contributions.ts';
import { rolloversDue } from '../rollover.service.ts';

const ike = (fields: Partial<DBGoal> = {}): DBGoal =>
  ({
    id: 'g-2026',
    createdAt: new Date(2026, 0, 1),
    description: 'IKE',
    currency: 'PLN',
    strategyPart: STRATEGY_PART.LONG_TERM_SAVINGS,
    keepsItsMoney: true,
    target: 30000,
    deadline: new Date(2026, 11, 31),
    year: 2026,
    seriesId: 's1',
    ...fields,
  }) as DBGoal;

const gave = (amount: number): DBContribution =>
  ({ id: `c${amount}`, goalId: 'g-2026', amount, contributedAt: new Date(2026, 5, 1) }) as DBContribution;

describe('rolloversDue', () => {
  it('has nothing to do while the year is still running', () => {
    expect(
      rolloversDue({ goals: [ike()], contributions: [gave(26000)], today: new Date(2026, 11, 30) })
    ).toEqual([]);
  });

  /**
   * What leaves the pot has to arrive somewhere, or the rollover is silent data loss: 26 000 that
   * were there in December are nowhere in January, and the lifetime figure has nothing to sum.
   */
  it('closes the window with what actually went in, and opens the next one empty', () => {
    const [rollover] = rolloversDue({
      goals: [ike()],
      contributions: [gave(20000), gave(6000)],
      today: new Date(2027, 0, 2),
    });

    expect(rollover.closing).toMatchObject({
      goalId: 'g-2026',
      seriesId: 's1',
      year: 2026,
      target: 30000,
      contributed: 26000,
    });
    expect(rollover.opening).toMatchObject({
      description: 'IKE',
      target: 30000,
      year: 2027,
      seriesId: 's1',
      keepsItsMoney: true,
      strategyPart: STRATEGY_PART.LONG_TERM_SAVINGS,
    });
  });

  it('opens the next window on the same days of the year the last one used', () => {
    const [rollover] = rolloversDue({
      goals: [ike()],
      contributions: [],
      today: new Date(2027, 0, 2),
    });

    expect(rollover.opening.deadline).toEqual(new Date(2027, 11, 31));
  });

  /** A year that has already been closed is not closed again, however often the app is opened. */
  it('does nothing for a goal that has already rolled', () => {
    expect(
      rolloversDue({
        goals: [ike({ closedAt: new Date(2027, 0, 1) }), ike({ id: 'g-2027', year: 2027 })],
        contributions: [],
        today: new Date(2027, 0, 2),
      })
    ).toEqual([]);
  });

  it('never rolls a one-off goal', () => {
    expect(
      rolloversDue({
        goals: [ike({ year: undefined, seriesId: undefined })],
        contributions: [],
        today: new Date(2027, 0, 2),
      })
    ).toEqual([]);
  });
});
