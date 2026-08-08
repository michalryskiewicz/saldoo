import { describe, expect, it } from 'vitest';
import { STRATEGY_PART } from '@/constant.ts';
import type { DBGoal } from '@/database/goals.ts';
import type { DBContribution } from '@/database/contributions.ts';
import { goalProgress, totalPutAside } from '../goal-progress.service.ts';

const APRIL_2026 = new Date(2026, 3, 15);

const goal = (fields: Partial<DBGoal>): DBGoal =>
  ({
    id: 'g1',
    description: 'Wakacje',
    currency: 'PLN',
    strategyPart: STRATEGY_PART.SAVINGS,
    keepsItsMoney: false,
    target: 8000,
    deadline: new Date(2026, 11, 31),
    ...fields,
  }) as DBGoal;

const gave = (goalId: string, amount: number): DBContribution =>
  ({ id: `c-${goalId}-${amount}`, goalId, amount, contributedAt: APRIL_2026 }) as DBContribution;

describe('goalProgress', () => {
  it('says what is in the pot and how far along that is', () => {
    const [row] = goalProgress({
      goals: [goal({})],
      contributions: [gave('g1', 2000)],
      closedWindows: [],
      expenses: [],
      today: APRIL_2026,
    });

    expect(row.saved).toBe(2000);
    expect(row.target).toBe(8000);
    expect(row.percentage).toBe(25);
  });

  it('counts only what was given to this goal', () => {
    const [row] = goalProgress({
      goals: [goal({})],
      contributions: [gave('g1', 2000), gave('somebody-else', 5000)],
      closedWindows: [],
      expenses: [],
      today: APRIL_2026,
    });

    expect(row.saved).toBe(2000);
  });

  /**
   * A bar that goes past its end is a bar that has stopped meaning anything. Over-saving is not an
   * error and is not hidden — the figure says 9 000 of 8 000 — but the bar stays a bar.
   */
  it('does not draw a bar past its end when more went in than was asked for', () => {
    const [row] = goalProgress({
      goals: [goal({})],
      contributions: [gave('g1', 9000)],
      closedWindows: [],
      expenses: [],
      today: APRIL_2026,
    });

    expect(row.saved).toBe(9000);
    expect(row.percentage).toBe(100);
  });

  /**
   * A deadline in this month or already gone leaves no instalments to divide into, so the figure
   * is the whole remainder. It is the right number and "a month" is the wrong word for it — the
   * card reads "40 000 a month" and looks broken while being perfectly correct.
   *
   * Late is not a failing here; the only failure is abandoning a goal (#93 pt. 11). So the word
   * changes and nothing else does: no state, no colour, no telling-off.
   */
  it('says the figure is what is left, not a monthly one, once the deadline is here', () => {
    const thisMonth = goalProgress({
      goals: [goal({ deadline: new Date(2026, 3, 30) })],
      contributions: [],
      closedWindows: [],
      expenses: [],
      today: APRIL_2026,
    });
    const gone = goalProgress({
      goals: [goal({ deadline: new Date(2026, 1, 1) })],
      contributions: [],
      closedWindows: [],
      expenses: [],
      today: APRIL_2026,
    });
    const ahead = goalProgress({
      goals: [goal({ deadline: new Date(2026, 11, 31) })],
      contributions: [],
      closedWindows: [],
      expenses: [],
      today: APRIL_2026,
    });

    expect(thisMonth[0].dueNow).toBe(true);
    expect(gone[0].dueNow).toBe(true);
    expect(ahead[0].dueNow).toBe(false);
  });
});

describe('totalPutAside', () => {
  /**
   * The one number above the screen. A stock, not a streak: it does not shrink when somebody
   * stops, it stops growing (#93 pt. 4).
   */
  it('adds up what went towards every goal', () => {
    const total = totalPutAside({
      goals: [goal({ id: 'g1' }), goal({ id: 'g2' })],
      contributions: [gave('g1', 2000), gave('g2', 1500)],
    });

    expect(total).toBe(3500);
  });

  /**
   * The emergency fund is a goal and is not "put aside". The 8 000 for a holiday is not your
   * safety net, and the safety net is not your holiday — counting them as one number makes both
   * of them lies.
   */
  it('leaves the emergency fund out of it', () => {
    const total = totalPutAside({
      goals: [goal({ id: 'g1' }), goal({ id: 'fund', coverageMonths: 3, target: undefined })],
      contributions: [gave('g1', 2000), gave('fund', 10000)],
    });

    expect(total).toBe(2000);
  });
});

/**
 * A goal that reads what is actually held against it, rather than what somebody remembered to
 * declare. This is what makes "you have 4.2 months of cover" a fact instead of a diary entry.
 */
describe('a goal backed by holdings', () => {
  const held = [
    { id: 'konto', description: 'Konto', value: 8000, assignments: [{ goalId: 'g1', share: 100 }] },
    { id: 'edo', description: 'EDO0836', value: 5000, assignments: [{ goalId: 'g1', share: 40 }] },
  ];

  it('reads its progress out of the holdings pointed at it', () => {
    const [row] = goalProgress({
      goals: [goal({ funding: 'holdings' })],
      contributions: [],
      closedWindows: [],
      expenses: [],
      holdings: held,
      today: APRIL_2026,
    });

    expect(row.saved).toBe(10000);
    expect(row.backing.map((one) => one.description)).toEqual(['Konto', 'EDO0836']);
  });

  /**
   * Never both. A declaration and the account the money landed in are the same złoty seen twice,
   * and adding them is how a card comes to read double.
   */
  it('ignores declarations once it is backed by holdings', () => {
    const [row] = goalProgress({
      goals: [goal({ funding: 'holdings' })],
      contributions: [gave('g1', 3000)],
      closedWindows: [],
      expenses: [],
      holdings: held,
      today: APRIL_2026,
    });

    expect(row.saved).toBe(10000);
  });

  /** And the other way round: a goal nobody moved to holdings keeps counting what was declared. */
  it('leaves a contribution-tracked goal reading its contributions', () => {
    const [row] = goalProgress({
      goals: [goal({})],
      contributions: [gave('g1', 3000)],
      closedWindows: [],
      expenses: [],
      holdings: held,
      today: APRIL_2026,
    });

    expect(row.saved).toBe(3000);
    expect(row.backing).toEqual([]);
  });
});
