import { differenceInCalendarMonths } from 'date-fns';
import type { DBContribution } from '@/database/contributions.ts';
import type { DBGoal } from '@/database/goals.ts';
import { completionDate, requiredMonthlyContribution } from '@/lib/goals.ts';

/** How far back the app looks to judge what somebody actually manages. */
const MONTHS_OF_HISTORY = 6;

export type DeadlineOffer = {
  /** What the person has actually been managing, per month. */
  pace: number;
  /** When that pace gets there. */
  deadline: Date;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
};

/**
 * A later date, offered when a goal has outgrown what the person actually manages.
 *
 * **The number is never raised instead.** Demanding more from somebody already behind is how an
 * app turns a bad month into a reason to stop opening it, and the only failure in this system is
 * abandoning a goal, not being late with one (#93 pt. 11). So the app moves the date and says so
 * out loud: *"at 640 a month this is ready in November rather than July."*
 *
 * **The median, and only of what a statement confirmed.** A declaration nobody's bank has backed
 * yet is not evidence of what somebody can manage — it is evidence of what they meant to do. A
 * mean would let one unusual month rewrite the judgement; a median is what somebody does in an
 * ordinary month, which is the question being asked.
 *
 * Nothing is offered without history: a pace of zero produces no date, and inventing one from no
 * evidence would be the app guessing about the person's life.
 */
export const deadlineOffer = (
  goal: DBGoal,
  contributions: DBContribution[],
  today: Date
): DeadlineOffer | undefined => {
  if (!goal.deadline) return undefined;

  const mine = contributions.filter((contribution) => contribution.goalId === goal.id);
  const saved = mine.reduce((total, contribution) => total + contribution.amount, 0);

  const recentlyConfirmed = mine.filter(
    (contribution) =>
      Boolean(contribution.transactionId) &&
      differenceInCalendarMonths(today, new Date(contribution.contributedAt)) < MONTHS_OF_HISTORY
  );

  if (!recentlyConfirmed.length) return undefined;

  const byMonth = new Map<string, number>();

  for (const contribution of recentlyConfirmed) {
    const day = new Date(contribution.contributedAt);
    const key = `${day.getFullYear()}-${day.getMonth()}`;

    byMonth.set(key, (byMonth.get(key) ?? 0) + contribution.amount);
  }

  const pace = median([...byMonth.values()]);
  const required = requiredMonthlyContribution(
    { target: goal.target ?? 0, saved, deadline: goal.deadline },
    today
  );

  if (pace <= 0 || required <= pace) return undefined;

  const deadline = completionDate(
    { target: goal.target ?? 0, saved, monthlyPace: pace },
    today
  );

  return deadline ? { pace, deadline } : undefined;
};
