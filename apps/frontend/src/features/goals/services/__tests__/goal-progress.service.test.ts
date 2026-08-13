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

  /**
   * The consequence the card is there to state: what this goal costs the month it is in. The same
   * figure the overview takes off what is free, from the same rule, so the two screens cannot say
   * different things about one goal.
   */
  it('says what the goal takes out of this month', () => {
    const [row] = goalProgress({
      goals: [goal({ target: 8000, deadline: new Date(2026, 7, 31) })],
      // Put in before this month, so what is left is spread over the months that remain rather
      // than counting as this month's own contribution.
      contributions: [
        { ...gave('g1', 2000), contributedAt: new Date(2026, 2, 12) } as DBContribution,
      ],
      closedWindows: [],
      expenses: [],
      today: APRIL_2026,
    });

    expect(row.takesFromFree).toBe(1500);
  });

  /** Putting in more than the month asked for is not an error, and the extra really is gone. */
  it('takes the larger figure when more went in than was asked for', () => {
    const [row] = goalProgress({
      goals: [goal({ target: 8000, deadline: new Date(2026, 7, 31) })],
      contributions: [gave('g1', 2000)],
      closedWindows: [],
      expenses: [],
      today: APRIL_2026,
    });

    expect(row.takesFromFree).toBe(2000);
  });

  /**
   * The fund is set in months, so it is read back in months. A bar at 60% is not something anybody
   * can plan around; "you could live 1.8 months on this" is.
   */
  it('reads the fund back in the unit it was set in', () => {
    const [row] = goalProgress({
      goals: [
        goal({
          target: undefined,
          deadline: undefined,
          coverageMonths: 3,
          monthlyPace: 500,
        }),
      ],
      contributions: [gave('g1', 1800)],
      closedWindows: [],
      // 1 000 a month of costs that would survive losing the income, plus the 10% the fund carries:
      // a target of 3 300, so 1 800 is 1.6 months of it.
      expenses: [
        {
          expense: 1000,
          frequency: 'MONTHLY',
          execution: new Date(2026, 3, 10),
          survivesIncomeLoss: true,
        } as never,
      ],
      today: APRIL_2026,
    });

    expect(row.target).toBe(3300);
    expect(row.coverageNow).toBe(1.6);
  });

  /**
   * The one proactive thing on the screen, and it moves the date rather than the figure: demanding
   * more from somebody already behind is how an app turns a bad month into a reason to stop opening
   * it (#93 pt. 11).
   */
  it('carries the later date on offer when a goal has outgrown what somebody manages', () => {
    const paid = (month: number, amount: number): DBContribution =>
      ({
        id: `c${month}`,
        goalId: 'g1',
        amount,
        contributedAt: new Date(2026, month, 12),
        transactionId: `t${month}`,
      }) as DBContribution;

    const [row] = goalProgress({
      goals: [goal({ target: 20000, deadline: new Date(2026, 6, 31) })],
      contributions: [paid(0, 500), paid(1, 500), paid(2, 500)],
      closedWindows: [],
      expenses: [],
      today: APRIL_2026,
    });

    expect(row.offer?.pace).toBe(500);
    expect(row.offer?.deadline.getFullYear()).toBe(2029);
  });

  it('leaves coverage unsaid on a goal that is not the fund', () => {
    const [row] = goalProgress({
      goals: [goal({})],
      contributions: [],
      closedWindows: [],
      expenses: [],
      today: APRIL_2026,
    });

    expect(row.coverageNow).toBeUndefined();
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

describe('why a holdings-backed goal moved', () => {
  const spentFrom = (value: number, movedBy: number) => [
    {
      id: 'konto',
      description: 'Konto',
      value,
      assignments: [{ goalId: 'g1', share: 100 }],
      change: { amount: movedBy, since: new Date(2026, 4, 1) },
    },
  ];

  /**
   * The sentence a card cannot say without this: a fund that fell because the account it sits in was
   * spent out of. Correct arithmetic that reads as a fault, or as something the person did and
   * cannot remember, until the cause is named beside it.
   */
  it('carries what the backing did', () => {
    const [row] = goalProgress({
      goals: [goal({ funding: 'holdings' })],
      contributions: [],
      closedWindows: [],
      expenses: [],
      holdings: spentFrom(20000, -5000),
      today: APRIL_2026,
    });

    expect(row.moved).toEqual({ amount: -5000, since: new Date(2026, 4, 1) });
  });

  /**
   * And for the fund, what it cost in the unit the fund is actually about. "Down 5 000" is a fact
   * about an account; "three months of cover instead of four" is the same fact about the person.
   */
  it('says what the cover was before, for the fund', () => {
    const [row] = goalProgress({
      goals: [goal({ funding: 'holdings', coverageMonths: 6, monthlyPace: 500, target: undefined })],
      contributions: [],
      closedWindows: [],
      // 3 000 a month of costs that survive losing an income, plus the 10% the fund carries: a
      // target of 19 800, so one month of cover is 3 300 of it.
      expenses: [
        {
          expense: 3000,
          frequency: 'MONTHLY',
          execution: new Date(2026, 3, 10),
          survivesIncomeLoss: true,
        } as never,
      ],
      holdings: spentFrom(9900, -3300),
      today: APRIL_2026,
    });

    // Three months of cover now; before the account lost a month's worth of it, four.
    expect(row.coverageNow).toBe(3);
    expect(row.coverageBefore).toBe(4);
  });

  it('has no cover-before where nothing moved', () => {
    const [row] = goalProgress({
      goals: [goal({ funding: 'holdings' })],
      contributions: [],
      closedWindows: [],
      expenses: [],
      holdings: [
        { id: 'konto', description: 'Konto', value: 8000, assignments: [{ goalId: 'g1', share: 100 }] },
      ],
      today: APRIL_2026,
    });

    expect(row.moved).toBeUndefined();
    expect(row.coverageBefore).toBeUndefined();
  });
});
