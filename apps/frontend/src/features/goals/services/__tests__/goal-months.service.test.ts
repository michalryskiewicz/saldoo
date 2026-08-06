import { describe, expect, it } from 'vitest';
import type { DBContribution } from '@/database/contributions.ts';
import type { DBGoal } from '@/database/goals.ts';
import { confirmedPortion, goalMonths } from '../goal-months.service.ts';

const goal = (fields: Partial<DBGoal> = {}): DBGoal =>
  ({
    id: 'g1',
    createdAt: new Date(2026, 0, 10),
    description: 'Wakacje',
    deadline: new Date(2026, 5, 30),
    ...fields,
  }) as DBGoal;

const gave = (month: number, amount: number, transactionId?: string): DBContribution =>
  ({
    id: `c${month}-${amount}`,
    goalId: 'g1',
    amount,
    contributedAt: new Date(2026, month, 12),
    ...(transactionId ? { transactionId } : {}),
  }) as DBContribution;

describe('goalMonths', () => {
  /**
   * A month the goal did not move is **information**, and it stays on the list. There is no
   * "skipped" here on purpose: a bill nobody paid is neutral and a month somebody meant to save
   * and did not is not, so the app declines to offer a word that makes it disappear.
   */
  it('gives every month of the run, including the ones nothing went into', () => {
    const months = goalMonths(goal(), [gave(0, 1000), gave(3, 1000)], new Date(2026, 2, 15));

    expect(months).toHaveLength(6);
    expect(months.map((m) => m.contributed)).toEqual([1000, 0, 0, 1000, 0, 0]);
  });

  it('adds up a month somebody paid into twice', () => {
    const months = goalMonths(goal(), [gave(1, 400), gave(1, 600)], new Date(2026, 2, 15));

    expect(months[1].contributed).toBe(1000);
  });

  /**
   * A statement backs some of it and the rest is not wrong — most often it is a transfer somebody
   * meant to make and did, days before their bank got round to saying so.
   */
  it('says how much of a month a statement backs, without touching the rest', () => {
    const months = goalMonths(goal(), [gave(0, 1000, 'tx1'), gave(0, 500)], new Date(2026, 2, 15));

    expect(months[0].contributed).toBe(1500);
    expect(months[0].confirmed).toBe(1000);
  });

  /** A fund never ends, so its run is up to now rather than to a deadline it does not have. */
  it('runs to today for a goal with no deadline', () => {
    const months = goalMonths(goal({ deadline: undefined }), [], new Date(2026, 3, 15));

    expect(months).toHaveLength(4);
  });
});

describe('confirmedPortion', () => {
  it('is what a statement backs out of everything declared', () => {
    expect(confirmedPortion([gave(0, 1000, 'tx1'), gave(1, 500), gave(2, 500, 'tx2')])).toEqual({
      declared: 2000,
      confirmed: 1500,
    });
  });

  /**
   * A match the person rejected is not a confirmation. `null` is how an unlinked one is recorded —
   * distinct from "nobody has looked yet", which is absent.
   */
  it('does not count a match somebody unlinked', () => {
    expect(confirmedPortion([{ ...gave(0, 1000), transactionId: null } as DBContribution])).toEqual({
      declared: 1000,
      confirmed: 0,
    });
  });
});
