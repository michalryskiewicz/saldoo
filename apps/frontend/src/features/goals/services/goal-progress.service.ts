import { differenceInCalendarMonths } from 'date-fns';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBContribution } from '@/database/contributions.ts';
import { type DBClosedWindow, type DBGoal, isEmergencyFund } from '@/database/goals.ts';
import {
  completionDate,
  emergencyFundTarget,
  lifetimeOfSeries,
  requiredMonthlyContribution,
} from '@/lib/goals.ts';
import {
  type BackableHolding,
  type Backing,
  backedValue,
  backingOf,
} from '@/features/goals/services/goal-backing.service.ts';

export type GoalProgress = {
  goal: DBGoal;
  /** What is in the pot now. */
  saved: number;
  /** Typed for a goal, worked out from the level for the fund. */
  target: number;
  /** Capped at 100 — see below. */
  percentage: number;
  /** What has to go in each month to be on time. Absent on the fund, which is paced instead. */
  requiredMonthly?: number;
  /**
   * Whether the deadline is this month or already gone, so `requiredMonthly` is the whole
   * remainder rather than an instalment.
   *
   * The figure is right either way; the word for it is not. A card reading "40 000 a month" looks
   * broken while being perfectly correct, so the screen says what is left instead. Nothing else
   * changes — no state, no colour, no telling-off. Late is not a failing here; the only failure is
   * abandoning a goal (#93 pt. 11).
   */
  dueNow: boolean;
  /** When the pace gets there. Present on the fund, which is the goal with no deadline. */
  completesOn?: Date;
  /** Everything this series has ever held, for a goal that rolls. */
  lifetime?: number;
  /** What stands behind it, for a goal that reads its holdings instead of its declarations. */
  backing: Backing[];
};

type ProgressInput = {
  goals: DBGoal[];
  contributions: DBContribution[];
  closedWindows: DBClosedWindow[];
  /** What the emergency fund's target is computed from. */
  expenses: DBExpense[];
  /** Everything held, already in one currency, for the goals that read their holdings. */
  holdings?: BackableHolding[];
  today: Date;
};

const savedTowards = (goalId: string, contributions: DBContribution[]): number =>
  Number(
    contributions
      .filter((contribution) => contribution.goalId === goalId)
      .reduce((total, contribution) => total + contribution.amount, 0)
      .toFixed(2)
  );

/**
 * Each goal with the figures the screen draws it from.
 *
 * The bar is **capped at 100** and the amount is not. Somebody who put 9 000 into an 8 000 goal
 * reads "9 000 of 8 000" beside a full bar — over-saving is not an error and is not hidden, but a
 * bar drawn past its own end has stopped meaning anything.
 */
export const goalProgress = ({
  goals,
  contributions,
  closedWindows,
  expenses,
  holdings = [],
  today,
}: ProgressInput): GoalProgress[] =>
  goals.map((goal) => {
    // One or the other, never the sum. A goal whose money sits in an account that is itself
    // assigned to it would otherwise count the same złoty twice — once as a declaration somebody
    // typed and once as the holding it landed in.
    const backing = goal.funding === 'holdings' ? backingOf(goal.id, holdings) : [];
    const saved =
      goal.funding === 'holdings'
        ? backedValue(goal.id, holdings)
        : savedTowards(goal.id, contributions);
    const target = isEmergencyFund(goal)
      ? emergencyFundTarget(goal.coverageMonths!, today.getMonth(), expenses)
      : (goal.target ?? 0);

    return {
      goal,
      saved,
      target,
      percentage: target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0,
      requiredMonthly: goal.deadline
        ? requiredMonthlyContribution({ target, saved, deadline: goal.deadline }, today)
        : undefined,
      dueNow: Boolean(goal.deadline) && differenceInCalendarMonths(new Date(goal.deadline!), today) <= 0,
      completesOn: goal.monthlyPace
        ? completionDate({ target, saved, monthlyPace: goal.monthlyPace }, today)
        : undefined,
      lifetime: goal.seriesId
        ? lifetimeOfSeries(
            closedWindows.filter((window) => window.seriesId === goal.seriesId),
            saved
          )
        : undefined,
      backing,
    };
  });

/**
 * The one number above the goals: everything put aside, ever.
 *
 * A stock rather than a series. It does not shrink when somebody stops — it stops growing — which
 * is what makes a bad month survivable and why no streak appears anywhere in this design (#93 pt. 4).
 *
 * **The emergency fund is not in it.** The fund is a goal, but the 8 000 for a holiday is not your
 * safety net and the safety net is not your holiday; adding them makes both figures lie.
 */
export const totalPutAside = ({
  goals,
  contributions,
}: Pick<ProgressInput, 'goals' | 'contributions'>): number => {
  const counted = new Set(goals.filter((goal) => !isEmergencyFund(goal)).map((goal) => goal.id));

  return Number(
    contributions
      .filter((contribution) => counted.has(contribution.goalId))
      .reduce((total, contribution) => total + contribution.amount, 0)
      .toFixed(2)
  );
};
