import { describe, expect, it } from 'vitest';
import type { DBContribution } from '@/database/contributions.ts';
import type { DBGoal } from '@/database/goals.ts';
import { inThePot, monumentFor, whatWasBuilt } from '../monument.service.ts';

const goal = (fields: Partial<DBGoal> = {}): DBGoal =>
  ({
    id: 'g1',
    createdAt: new Date(2026, 0, 10),
    description: 'Wakacje',
    target: 20000,
    ...fields,
  }) as DBGoal;

const moved = (amount: number, month: number, out = false): DBContribution =>
  ({
    id: `c${month}-${amount}`,
    goalId: 'g1',
    amount,
    contributedAt: new Date(2026, month, 5),
    ...(out ? { isWithdrawal: true } : {}),
  }) as DBContribution;

describe('inThePot and whatWasBuilt', () => {
  /**
   * The whole point of #93 pt. 5, and the two figures exist because they answer different
   * questions. Reaching a goal and spending it is the plan **working**; a single figure would
   * report the best month of somebody's year as a loss.
   */
  it('lets the pot fall when the money is spent, and never what was built', () => {
    const movements = [moved(8000, 0), moved(12000, 3), moved(20000, 6, true)];

    expect(inThePot(movements)).toBe(0);
    expect(whatWasBuilt(movements)).toBe(20000);
  });

  it('counts a partial withdrawal against the pot and nothing else', () => {
    const movements = [moved(10000, 0), moved(3000, 4, true)];

    expect(inThePot(movements)).toBe(7000);
    expect(whatWasBuilt(movements)).toBe(10000);
  });
});

describe('monumentFor', () => {
  it('records what went in and how long it took', () => {
    const monument = monumentFor(
      goal(),
      [moved(8000, 0), moved(12000, 3)],
      { reached: true, on: new Date(2026, 3, 20) }
    );

    expect(monument).toMatchObject({
      goalId: 'g1',
      target: 20000,
      contributed: 20000,
      reached: true,
    });
    // January to April, which is how long it actually took.
    expect(monument.monthsItTook).toBe(3);
  });

  /**
   * Giving up still leaves a trace. That money really was put aside, and an app that erases it on
   * the way out is telling somebody the four months they managed did not happen.
   */
  it('leaves a trace when somebody gives up', () => {
    const monument = monumentFor(
      goal(),
      [moved(4200, 0)],
      { reached: false, on: new Date(2026, 7, 1) }
    );

    expect(monument.reached).toBe(false);
    expect(monument.contributed).toBe(4200);
  });

  it('counts what was built, not what is left after spending it', () => {
    const monument = monumentFor(
      goal(),
      [moved(20000, 0), moved(20000, 5, true)],
      { reached: true, on: new Date(2026, 5, 20) }
    );

    expect(monument.contributed).toBe(20000);
  });
});
