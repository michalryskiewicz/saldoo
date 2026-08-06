import { addMonths, differenceInCalendarMonths } from 'date-fns';
import type { DBExpense } from '@/database/expenses.ts';
import type { CoverageMonths } from '@/database/goals.ts';
import { calculateFinancialSafetyNet } from '@/lib/expenses.ts';

type PacedGoal = {
  target: number;
  /** What is already in the pot. */
  saved: number;
  deadline: Date | string;
};

/**
 * What has to go in each month for a goal to be reached on time.
 *
 * **What is left over the months left**, not the target over the whole run. The figure a person
 * needs is the one that answers "what do I do now", and it falls as they save — which is the
 * point. Computed from the target it would go on demanding the opening amount from somebody
 * already three quarters of the way there.
 *
 * A deadline already past does not make this infinite or zero. What is left is owed, and it is
 * owed now: the months are floored at one, so the answer is the remainder rather than a number
 * that cannot be acted on.
 */
export const requiredMonthlyContribution = (
  { target, saved, deadline }: PacedGoal,
  from: Date
): number => {
  const remaining = Math.max(0, target - saved);

  if (remaining === 0) return 0;

  const monthsLeft = Math.max(1, differenceInCalendarMonths(new Date(deadline), from));

  return Number((remaining / monthsLeft).toFixed(2));
};

type FundedGoal = {
  target: number;
  saved: number;
  /** What the person means to put aside each month. */
  monthlyPace: number;
};

/**
 * The month a pace gets there in — the same relationship as the required contribution, read from
 * the other end.
 *
 * The emergency fund needs this one. It has no deadline to divide by, so it is given a pace and
 * shown the date that follows: *"at 500 a month you have three months of costs covered by
 * September 2027"*. A bar with no end in sight says nothing a person can act on.
 *
 * Rounded **up**. Two thirds of a month is a month you still have to live through, and a date that
 * arrives before the money does is worse than no date.
 *
 * `undefined` when nothing is going in. Not "never" and not a date a thousand years out: the
 * honest answer to "when, at this rate" is that there is no rate.
 */
export const completionDate = (
  { target, saved, monthlyPace }: FundedGoal,
  from: Date
): Date | undefined => {
  const remaining = Math.max(0, target - saved);

  if (remaining === 0) return from;
  if (monthlyPace <= 0) return undefined;

  return addMonths(from, Math.ceil(remaining / monthlyPace));
};

/**
 * What the emergency fund is aiming at, worked out from its level.
 *
 * The one goal whose target nobody types. A person picks 3, 6 or 12 months of cover and the
 * amount follows from what those months actually cost — which since #100 means only the costs
 * that survive losing the income, because a fund sized on the gym membership would have somebody
 * save up for a year of a subscription they would cancel in the first week.
 *
 * **Accept knowingly that this breathes.** Rent goes up and the target rises with it, so coverage
 * falls from 4.2 months to 3.8 with nothing having left the account. The screen says *"your costs
 * went up, the fund now covers 3.8 months"* — never *"you lost 0.4 of a level"*.
 */
export const emergencyFundTarget = (
  coverageMonths: CoverageMonths,
  monthIndex: number,
  expenses: DBExpense[]
): number => {
  const windows = calculateFinancialSafetyNet(monthIndex, expenses);

  return { 3: windows.small, 6: windows.medium, 12: windows.comfort }[coverageMonths];
};

/**
 * Everything a yearly goal has ever held: the windows that closed, plus the one still open.
 *
 * Derived on every read and stored nowhere. A second number would be a second thing to keep in
 * step, and the first time they disagreed the app would have no way to say which was right.
 *
 * What the figure *means* is not this function's business — it is the goal's `keepsItsMoney`. For
 * a holiday it is how much has been put through this; for IKE it is how much is held. The
 * arithmetic is the same and only one of the two sentences is ever true.
 */
export const lifetimeOfSeries = (
  closedWindows: { contributed: number }[],
  currentlyInThePot: number
): number =>
  Number(
    closedWindows
      .reduce((total, window) => total + window.contributed, currentlyInThePot)
      .toFixed(2)
  );
