import { describe, expect, it } from 'vitest';
import type { DBContribution } from '@/database/contributions.ts';
import type { DBGoal } from '@/database/goals.ts';
import { coverageInMonths, monthlyClaim } from '../monthly-claim.service.ts';

const TODAY = new Date(2026, 7, 20);

const goal = (fields: Partial<DBGoal> = {}): DBGoal =>
  ({
    id: 'g1',
    description: 'Wakacje',
    strategyPart: 'SAVINGS',
    target: 6000,
    deadline: new Date(2026, 9, 30),
    ...fields,
  }) as DBGoal;

const putAside = (amount: number, fields: Partial<DBContribution> = {}): DBContribution =>
  ({
    id: `c${amount}`,
    goalId: 'g1',
    amount,
    contributedAt: new Date(2026, 7, 12),
    ...fields,
  }) as DBContribution;

describe('monthlyClaim', () => {
  it('asks for what is left over the months left', () => {
    const claim = monthlyClaim({ goal: goal(), contributions: [], today: TODAY });

    expect(claim.required).toBe(3000);
    expect(claim.takesFromFree).toBe(3000);
  });

  it('asks the fund for its pace, which is what it has instead of a deadline', () => {
    const claim = monthlyClaim({
      goal: goal({ deadline: undefined, coverageMonths: 3, monthlyPace: 500 }),
      contributions: [],
      today: TODAY,
    });

    expect(claim.required).toBe(500);
  });

  /** A declaration has no payment behind it, so the money is still to leave and stays claimed. */
  it('keeps claiming what was only declared', () => {
    const claim = monthlyClaim({ goal: goal(), contributions: [putAside(3000)], today: TODAY });

    expect(claim.takesFromFree).toBe(3000);
  });

  /** Once a statement backs it the payment is an outflow like any other, counted where those are. */
  it('stops claiming what a statement has confirmed', () => {
    const claim = monthlyClaim({
      goal: goal(),
      contributions: [putAside(3000, { transactionId: 't1' })],
      today: TODAY,
    });

    expect(claim.takesFromFree).toBe(0);
  });

  it('claims the larger figure when more went in than the month asked for', () => {
    const claim = monthlyClaim({ goal: goal(), contributions: [putAside(5000)], today: TODAY });

    expect(claim.reserved).toBe(5000);
    expect(claim.takesFromFree).toBe(5000);
  });

  it('counts only this month towards the claim', () => {
    const claim = monthlyClaim({
      goal: goal(),
      contributions: [putAside(1000, { contributedAt: new Date(2026, 6, 12) })],
      today: TODAY,
    });

    // A thousand of the six is already in, so what is left over the two months left is 2 500 —
    // and none of it counts as put in *this* month.
    expect(claim.required).toBe(2500);
    expect(claim.takesFromFree).toBe(2500);
  });
});

describe('coverageInMonths', () => {
  /**
   * The fund's own answer, in the unit it was set in. A bar at 70% says nothing a person can
   * plan around; "you can live 2.1 months on this" does.
   */
  it('is how long the pot would last at the cost the target was built from', () => {
    expect(coverageInMonths({ saved: 7000, target: 10000, coverageMonths: 3 })).toBe(2.1);
  });

  it('is nothing when the target has not been worked out yet', () => {
    expect(coverageInMonths({ saved: 7000, target: 0, coverageMonths: 3 })).toBeUndefined();
  });

  /** Over-saving is not an error and the figure keeps counting past the level that was asked for. */
  it('goes past the level somebody chose', () => {
    expect(coverageInMonths({ saved: 12000, target: 10000, coverageMonths: 3 })).toBe(3.6);
  });
});
