import type { DBContribution } from '@/database/contributions.ts';
import type { DBGoal } from '@/database/goals.ts';
import type { CoverageMonths } from '@/database/goals.ts';
import { requiredMonthlyContribution } from '@/lib/goals.ts';

export type MonthlyClaim = {
  /** What has to go in this month to be on time, or the fund's pace. */
  required: number;
  /** What the month is holding for this goal: what it asked for, or more if more went in. */
  reserved: number;
  /** How much of that a statement has already backed. */
  confirmed: number;
  /** What the goal takes out of the money still free this month. */
  takesFromFree: number;
};

type ClaimInput = {
  goal: DBGoal;
  /** Every contribution, not only this month's: what is already saved sets what is still required. */
  contributions: DBContribution[];
  today: Date;
};

const round = (amount: number) => Number(amount.toFixed(2));

const inMonth = (day: Date | string, today: Date): boolean => {
  const date = new Date(day);

  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
};

/**
 * What one goal asks of this month, and how much of that is still to come out.
 *
 * **One rule, read by two screens.** The overview subtracts it from what is free and the goal's own
 * card says the same figure back as a consequence — *"1 200 this month, which is 1 200 less you
 * have free"*. Two implementations would be two answers to one question, and the first time they
 * disagreed neither screen could be trusted.
 *
 * Saying money went aside must not make somebody richer, so a declaration stays claimed until a
 * statement backs it; once one does, the payment is an outflow like any other and is counted
 * there instead. Putting in more than the month asked for claims the larger figure — the extra is
 * really gone.
 */
export const monthlyClaim = ({ goal, contributions, today }: ClaimInput): MonthlyClaim => {
  const mine = contributions.filter((contribution) => contribution.goalId === goal.id);
  const saved = mine.reduce((total, contribution) => total + contribution.amount, 0);

  const thisMonth = mine.filter((contribution) => inMonth(contribution.contributedAt, today));
  const contributed = thisMonth.reduce((total, contribution) => total + contribution.amount, 0);
  const confirmed = thisMonth
    .filter((contribution) => Boolean(contribution.transactionId))
    .reduce((total, contribution) => total + contribution.amount, 0);

  const required = goal.deadline
    ? requiredMonthlyContribution({ target: goal.target ?? 0, saved, deadline: goal.deadline }, today)
    : (goal.monthlyPace ?? 0);

  const reserved = Math.max(required, contributed);

  return {
    required: round(required),
    reserved: round(reserved),
    confirmed: round(confirmed),
    takesFromFree: round(Math.max(0, reserved - confirmed)),
  };
};

/**
 * How many months of living the emergency fund would actually buy.
 *
 * The fund is the one goal set in months rather than in money, so months are the unit it should be
 * read back in: a bar at 70% says nothing a person can plan around, and *"you could live 2.1
 * months on this"* says the whole thing.
 *
 * It keeps counting past the level somebody chose — over-saving is not an error — and it is
 * `undefined` while there is no target, which is the state of a fund on an account with no costs
 * on it yet. Nothing divided by nothing is not zero months of cover; it is no answer.
 */
export const coverageInMonths = ({
  saved,
  target,
  coverageMonths,
}: {
  saved: number;
  target: number;
  coverageMonths: CoverageMonths;
}): number | undefined => {
  if (target <= 0) return undefined;

  return Number(((saved / (target / coverageMonths))).toFixed(1));
};
