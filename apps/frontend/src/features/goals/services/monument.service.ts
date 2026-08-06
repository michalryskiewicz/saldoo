import { differenceInCalendarMonths } from 'date-fns';
import type { DBContribution } from '@/database/contributions.ts';
import type { DBClosedWindow, DBGoal } from '@/database/goals.ts';

const round = (amount: number) => Number(amount.toFixed(2));

const wentIn = (movements: DBContribution[]) =>
  movements.filter((movement) => !movement.isWithdrawal);

/**
 * What is in the pot now — everything put in, less everything taken out.
 *
 * This one is allowed to fall, and falling is not a failure: reaching a goal and spending it is
 * the plan working.
 */
export const inThePot = (movements: DBContribution[]): number =>
  round(
    movements.reduce(
      (total, movement) => total + (movement.isWithdrawal ? -movement.amount : movement.amount),
      0
    )
  );

/**
 * What was built — everything ever put in, and nothing taken off it.
 *
 * The two figures exist because they answer different questions, and a single one would report
 * the best month of somebody's year as a loss (#93 pt. 5). Spending a holiday fund on a holiday
 * empties the pot; it does not unmake the fourteen months of saving that filled it.
 */
export const whatWasBuilt = (movements: DBContribution[]): number =>
  round(wentIn(movements).reduce((total, movement) => total + movement.amount, 0));

export type MonumentDraft = Omit<DBClosedWindow, 'id' | 'createdAt' | 'seriesId' | 'year'> & {
  seriesId?: string;
  year?: number;
  /** Whether it was reached. Asked once, on closing, and only then. */
  reached: boolean;
  monthsItTook: number;
};

/**
 * The permanent record a closed goal leaves.
 *
 * **Giving up still leaves one.** That money really was put aside, and an app that erases it on
 * the way out is telling somebody the four months they managed did not happen.
 *
 * What it records is what was *built*, never what is left after spending it — see `whatWasBuilt`.
 */
export const monumentFor = (
  goal: DBGoal,
  movements: DBContribution[],
  closed: { reached: boolean; on: Date }
): MonumentDraft => ({
  goalId: goal.id,
  seriesId: goal.seriesId,
  year: goal.year,
  target: goal.target ?? 0,
  contributed: whatWasBuilt(movements),
  openedOn: new Date(goal.createdAt),
  closedOn: closed.on,
  reached: closed.reached,
  monthsItTook: Math.max(0, differenceInCalendarMonths(closed.on, new Date(goal.createdAt))),
});
