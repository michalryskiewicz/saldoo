/**
 * Why the table has nothing to show — because the three reasons look identical and lead
 * somewhere different.
 *
 * Nothing to generate from, nothing due in the month being looked at, and nothing that survived
 * the filter are three separate facts. Answering all of them with one wording sends somebody
 * from the second case to "add an expense", and they add a second insurance because the screen
 * implied they had none.
 */
export type DutiesEmptyReason = 'no-expenses' | 'none-in-range' | 'filtered';

type DutiesEmptyReasonArgs = {
  hasExpenses: boolean;
  dutiesInRange: number;
  visibleRows: number;
};

export function dutiesEmptyReason({
  hasExpenses,
  dutiesInRange,
  visibleRows,
}: DutiesEmptyReasonArgs): DutiesEmptyReason | null {
  if (visibleRows > 0) return null;
  if (!hasExpenses) return 'no-expenses';

  return dutiesInRange > 0 ? 'filtered' : 'none-in-range';
}
