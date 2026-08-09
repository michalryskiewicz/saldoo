import { describe, expect, it } from 'vitest';
import type { DBTransaction } from '@/database/transactions.ts';
import type { DBContribution } from '@/database/contributions.ts';
import { monthlyLeftovers, savingCapacity } from '../saving-capacity.service.ts';

const TODAY = new Date(2026, 7, 20);

const moved = (month: number, amount: number, day = 10): DBTransaction =>
  ({
    id: `t${month}-${amount}`,
    amount,
    transactionDate: new Date(2026, month, day).toISOString(),
  }) as DBTransaction;

const putAside = (month: number, amount: number, transactionId?: string): DBContribution =>
  ({
    id: `c${month}-${amount}`,
    goalId: 'g1',
    amount,
    contributedAt: new Date(2026, month, 12),
    ...(transactionId ? { transactionId } : {}),
  }) as DBContribution;

describe('monthlyLeftovers', () => {
  it('is what came in less what went out, month by month', () => {
    const leftovers = monthlyLeftovers({
      transactions: [moved(4, 9000), moved(4, -6000), moved(5, 9000), moved(5, -7500)],
      contributions: [],
      today: TODAY,
    });

    expect(leftovers.map((month) => month.leftover)).toEqual([3000, 1500]);
  });

  /**
   * Money put aside is not money spent, and a statement cannot tell the difference: a transfer to
   * a savings account leaves the account like any other payment. Left alone, the app would read
   * somebody's saving as evidence they cannot save.
   */
  it('adds back what a statement confirmed went to a goal', () => {
    const leftovers = monthlyLeftovers({
      transactions: [moved(4, 9000), moved(4, -6000), moved(4, -1000)],
      contributions: [putAside(4, 1000, 't-savings')],
      today: TODAY,
    });

    expect(leftovers[0].leftover).toBe(3000);
  });

  /**
   * A declaration nobody's bank has backed yet has no outflow behind it to cancel. Adding it would
   * credit the month with money that never moved.
   */
  it('leaves a declared contribution alone until a statement backs it', () => {
    const leftovers = monthlyLeftovers({
      transactions: [moved(4, 9000), moved(4, -6000)],
      contributions: [putAside(4, 1000)],
      today: TODAY,
    });

    expect(leftovers[0].leftover).toBe(3000);
  });

  /** The month in progress is not a month. Half of it has not happened. */
  it('stops at the last complete month', () => {
    const leftovers = monthlyLeftovers({
      transactions: [moved(6, 1000), moved(7, 5000)],
      contributions: [],
      today: TODAY,
    });

    expect(leftovers).toHaveLength(1);
    expect(leftovers[0].monthIndex).toBe(6);
  });

  /**
   * A month with nothing in it is absence, not a zero — most often it is a statement nobody has
   * imported yet, and counting it would drag the answer towards zero for a reason that has nothing
   * to do with the person's life.
   */
  it('skips a month with no statement behind it', () => {
    const leftovers = monthlyLeftovers({
      transactions: [moved(3, 2000), moved(5, 1000)],
      contributions: [],
      today: TODAY,
    });

    expect(leftovers.map((month) => month.monthIndex)).toEqual([3, 5]);
  });

  it('looks no further back than six months', () => {
    const leftovers = monthlyLeftovers({
      transactions: [moved(0, 500), moved(1, 500), moved(2, 500), moved(3, 500), moved(6, 500)],
      contributions: [],
      today: TODAY,
    });

    expect(leftovers.map((month) => month.monthIndex)).toEqual([1, 2, 3, 6]);
  });
});

describe('savingCapacity', () => {
  /**
   * The median, not the mean: one unusual month — a bonus, a boiler — would rewrite the judgement,
   * and the question being asked is what an ordinary month looks like.
   */
  it('is the middle of what the months actually left', () => {
    const capacity = savingCapacity({
      transactions: [
        moved(2, 1000),
        moved(3, 3000),
        moved(4, 2000),
        moved(5, 20000),
      ],
      contributions: [],
      today: TODAY,
    });

    expect(capacity).toBe(2500);
  });

  /**
   * Inventing a figure from one month would be the app guessing about somebody's life, and the
   * whole point of this number is that it is evidence rather than a plan.
   */
  it('says nothing until three months have happened', () => {
    const capacity = savingCapacity({
      transactions: [moved(4, 1000), moved(5, 1000)],
      contributions: [],
      today: TODAY,
    });

    expect(capacity).toBeUndefined();
  });

  /** Spending more than came in is an answer, and rounding it up to nothing would hide it. */
  it('reports a negative middle rather than clamping it', () => {
    const capacity = savingCapacity({
      transactions: [moved(3, -500), moved(4, -1500), moved(5, -1000)],
      contributions: [],
      today: TODAY,
    });

    expect(capacity).toBe(-1000);
  });
});
