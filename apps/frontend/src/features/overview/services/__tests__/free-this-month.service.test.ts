import { describe, expect, it } from 'vitest';
import type { DBTransaction } from '@/database/transactions.ts';
import type { DBContribution } from '@/database/contributions.ts';
import type { DBGoal } from '@/database/goals.ts';
import { freeThisMonth, type PricedDuty } from '../free-this-month.service.ts';

const TODAY = new Date(2026, 7, 20);

const base = {
  plannedIncome: 10000,
  transactions: [] as DBTransaction[],
  duties: [] as PricedDuty[],
  goals: [] as DBGoal[],
  contributions: [] as DBContribution[],
  today: TODAY,
};

const moved = (amount: number, day = 5, month = 7): DBTransaction =>
  ({
    id: `t${month}-${day}-${amount}`,
    amount,
    transactionDate: new Date(2026, month, day).toISOString(),
  }) as DBTransaction;

const owes = (price: number, fields: Partial<PricedDuty> = {}): PricedDuty =>
  ({
    id: `d${price}`,
    price,
    executionDate: new Date(2026, 7, 15),
    ...fields,
  }) as PricedDuty;

const goal = (fields: Partial<DBGoal> = {}): DBGoal =>
  ({
    id: 'g1',
    description: 'Wakacje',
    strategyPart: 'SAVINGS',
    target: 8000,
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

describe('freeThisMonth', () => {
  it('is the income nothing has a claim on yet', () => {
    expect(freeThisMonth(base).free).toBe(10000);
  });

  it('takes off what has already left the account', () => {
    const month = freeThisMonth({ ...base, transactions: [moved(-2500), moved(-300)] });

    expect(month.spent).toBe(2800);
    expect(month.free).toBe(7200);
  });

  /** Income that arrived is the plan being met, not extra money to spend twice. */
  it('does not count an incoming payment as a second income', () => {
    const month = freeThisMonth({ ...base, transactions: [moved(10000), moved(-2500)] });

    expect(month.free).toBe(7500);
  });

  it('takes off what is still owed this month', () => {
    const month = freeThisMonth({ ...base, duties: [owes(2500), owes(120)] });

    expect(month.owed).toBe(2620);
    expect(month.free).toBe(7380);
  });

  /**
   * The rule the strategy tiles already use: a duty with a payment behind it is that payment, and
   * counting the occurrence as well would charge the rent twice.
   */
  it('counts a duty its payment already covers only once', () => {
    const month = freeThisMonth({
      ...base,
      transactions: [moved(-2500)],
      duties: [owes(2500, { resolved: true, transactionId: 't-rent' })],
    });

    expect(month.spent).toBe(2500);
    expect(month.owed).toBe(0);
    expect(month.free).toBe(7500);
  });

  /**
   * Ticked by hand with no statement line behind it — the gap that would otherwise let a cost fall
   * out of both figures and quietly inflate what is free.
   */
  it('counts a duty somebody ticked off without a payment as spent', () => {
    const month = freeThisMonth({ ...base, duties: [owes(2500, { resolved: true })] });

    expect(month.spent).toBe(2500);
    expect(month.owed).toBe(0);
    expect(month.free).toBe(7500);
  });

  it('leaves a skipped duty out of both', () => {
    const month = freeThisMonth({ ...base, duties: [owes(2500, { ignored: true })] });

    expect(month.free).toBe(10000);
  });

  it('ignores a duty from another month', () => {
    const month = freeThisMonth({
      ...base,
      duties: [owes(2500, { executionDate: new Date(2026, 8, 15) })],
    });

    expect(month.free).toBe(10000);
  });

  /** A goal wanted this month asks for the whole remainder, so this is the deadline in reach. */
  it('reserves what the goals need this month', () => {
    const month = freeThisMonth({
      ...base,
      goals: [goal({ target: 6000, deadline: new Date(2026, 9, 30) })],
    });

    expect(month.goalsToFund).toBe(3000);
    expect(month.free).toBe(7000);
  });

  /**
   * Saying money went aside must not make the person richer. The declaration has no outflow
   * behind it yet, so it stays reserved rather than becoming free again.
   */
  it('keeps a declared contribution reserved until a statement backs it', () => {
    const month = freeThisMonth({
      ...base,
      goals: [goal({ target: 6000, deadline: new Date(2026, 9, 30) })],
      contributions: [putAside(3000)],
    });

    expect(month.free).toBe(7000);
  });

  /** Once the bank has said so it is an outflow like any other, and reserving it too would double it. */
  it('stops reserving a contribution once its payment is in', () => {
    const month = freeThisMonth({
      ...base,
      transactions: [moved(-3000)],
      goals: [goal({ target: 6000, deadline: new Date(2026, 9, 30) })],
      contributions: [putAside(3000, { transactionId: 't-savings' })],
    });

    expect(month.spent).toBe(3000);
    expect(month.goalsToFund).toBe(0);
    expect(month.free).toBe(7000);
  });

  /** Putting in more than the month asked for is not an error, and the extra is really gone. */
  it('reserves the larger figure when somebody put in more than was needed', () => {
    const month = freeThisMonth({
      ...base,
      goals: [goal({ target: 6000, deadline: new Date(2026, 9, 30) })],
      contributions: [putAside(5000)],
    });

    expect(month.goalsToFund).toBe(5000);
    expect(month.free).toBe(5000);
  });

  it('reserves the fund at its pace, which is what it has instead of a deadline', () => {
    const month = freeThisMonth({
      ...base,
      goals: [goal({ id: 'fund', coverageMonths: 3, monthlyPace: 500, target: undefined })],
    });

    expect(month.goalsToFund).toBe(500);
  });

  it('asks nothing of a goal that has been closed', () => {
    const month = freeThisMonth({
      ...base,
      goals: [goal({ target: 6000, deadline: new Date(2026, 9, 30), closedAt: new Date(2026, 6, 1) })],
    });

    expect(month.free).toBe(10000);
  });

  /** Owing more than came in is an answer. Clamping it to zero would hide the one month that matters. */
  it('goes negative rather than bottoming out', () => {
    const month = freeThisMonth({ ...base, plannedIncome: 1000, duties: [owes(2500)] });

    expect(month.free).toBe(-1500);
  });
});
