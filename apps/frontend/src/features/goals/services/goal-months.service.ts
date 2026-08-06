import { differenceInCalendarMonths } from 'date-fns';
import type { DBContribution } from '@/database/contributions.ts';
import type { DBGoal } from '@/database/goals.ts';

export type GoalMonth = {
  year: number;
  monthIndex: number;
  /** Everything said to have gone in that month. */
  contributed: number;
  /** How much of that a statement line backs. Never subtracted from the rest. */
  confirmed: number;
};

/** A contribution a statement backs — unlinked (`null`) is not the same as not yet looked at. */
const isConfirmed = (contribution: DBContribution): boolean => Boolean(contribution.transactionId);

const round = (amount: number) => Number(amount.toFixed(2));

/**
 * A goal's run, month by month, including the months nothing went into.
 *
 * **Computed, never stored.** An occurrence of a goal is a pure function of the goal and the
 * calendar — there is nothing in one that cannot be worked out — so this deliberately does not
 * copy the duty generator. Duties earn their table because a person can mark one *skipped*, and a
 * decision is not derived data (ADR 0001); #68 has that stored-derived-data question open already,
 * and goals have no skipped state on purpose. Copying a pattern that is under review to a case
 * that does not need it is how a doubt becomes two doubts.
 *
 * A month with nothing in it is on the list rather than missing from it. A bill nobody paid is
 * neutral; a month somebody meant to save in and did not is information, and the app declines to
 * offer a word that makes it disappear.
 *
 * To the deadline, or to now for a goal that has none — a fund does not end, so its run is however
 * long it has been going.
 */
export const goalMonths = (
  goal: DBGoal,
  contributions: DBContribution[],
  today: Date
): GoalMonth[] => {
  const from = new Date(goal.createdAt);
  const to = goal.deadline ? new Date(goal.deadline) : today;
  const span = Math.max(0, differenceInCalendarMonths(to, from));

  const mine = contributions.filter((contribution) => contribution.goalId === goal.id);

  return Array.from({ length: span + 1 }, (_, step) => {
    const month = new Date(from.getFullYear(), from.getMonth() + step, 1);
    const inThisMonth = mine.filter((contribution) => {
      const day = new Date(contribution.contributedAt);

      return day.getFullYear() === month.getFullYear() && day.getMonth() === month.getMonth();
    });

    return {
      year: month.getFullYear(),
      monthIndex: month.getMonth(),
      contributed: round(inThisMonth.reduce((total, one) => total + one.amount, 0)),
      confirmed: round(
        inThisMonth.filter(isConfirmed).reduce((total, one) => total + one.amount, 0)
      ),
    };
  });
};

/**
 * How much of what was declared a statement actually backs.
 *
 * Shown **beside** the figure, never instead of it and never subtracted from it. The number grows
 * on declarations because a contribution with nothing behind it is most often a transfer somebody
 * meant to make and did, days before their bank got round to saying so. Docking them for that
 * would punish the person for their bank's latency.
 */
export const confirmedPortion = (
  contributions: DBContribution[]
): { declared: number; confirmed: number } => ({
  declared: round(contributions.reduce((total, one) => total + one.amount, 0)),
  confirmed: round(
    contributions.filter(isConfirmed).reduce((total, one) => total + one.amount, 0)
  ),
});
