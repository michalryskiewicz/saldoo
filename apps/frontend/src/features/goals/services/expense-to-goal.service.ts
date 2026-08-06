import { endOfMonth, startOfDay } from 'date-fns';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBProfit } from '@/database/profits.ts';
import type { GoalDraft } from '@/database/goals.ts';
import { expenseCostInYear } from '@/lib/expense-amount.ts';

/** What a converted expense would look like as a goal, for the form to open on. */
export type PartialGoalDraft = Partial<GoalDraft> & Pick<GoalDraft, 'description' | 'strategyPart'>;

/**
 * A cost that was never a cost, restated as the goal it always was.
 *
 * **A year of it becomes the target.** A recurring cost has a rate rather than a target, and a
 * year is the shortest window in which a weekly habit and a yearly premium can be compared at all —
 * it is also what keeps the goal comparable with the expense it replaces on the strategy tile.
 *
 * **It rolls.** A cost that repeats is a commitment that repeats; an IKE allowance and a summer
 * holiday are both a fresh agreement each January.
 *
 * **It does not say whether the money stays yours.** That is the one thing the app cannot work out
 * — a life-insurance premium is arguably savings and *is* a bill — and getting it wrong changes
 * what the lifetime figure means: how much you have put through this, against how much you hold.
 * The form opens on this draft and the person answers that one themselves.
 */
export const goalDraftFromExpense = (
  expense: DBExpense,
  profits: DBProfit[],
  today: Date
): PartialGoalDraft => {
  const year = today.getFullYear();

  return {
    description: expense.description,
    strategyPart: expense.strategyPart!,
    target: expenseCostInYear(expense, profits, year),
    deadline: new Date(year, 11, 31),
    year,
  };
};

/**
 * The last day the thing being converted is still a cost.
 *
 * The end of the month it is converted in, never today. Ending a series keeps every occurrence up
 * to the ending day exactly as it was, marks and all (#70) — and cutting mid-month would drop
 * occurrences the person may already have paid, which is the one thing conversion must not cost
 * them.
 *
 * At midnight, which is what the form's date picker produces for every other `endsAt` in the app.
 * The comparison in `untilItEnds` accepts either, so this is about the field holding one kind of
 * value rather than two depending on who wrote it.
 */
export const lastDayItIsStillACost = (today: Date): Date => startOfDay(endOfMonth(today));
