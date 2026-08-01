/** What the status tabs above the table filter by. */
export type DutyStatus = 'all' | 'unpaid' | 'paid';

type MarkedDuty = { resolved?: boolean; ignored?: boolean };

/**
 * The occurrences a status tab is about.
 *
 * A skipped occurrence is neither: there is nothing to pay and nothing was paid, so it
 * belongs under neither tab. It stays under "all", which is where taking the skip back is
 * possible — hidden everywhere, a mis-click would be unreachable.
 */
export function selectVisibleDuties<T extends MarkedDuty>(duties: T[], status: DutyStatus): T[] {
  if (status === 'unpaid') return duties.filter((duty) => !duty.resolved && !duty.ignored);
  if (status === 'paid') return duties.filter((duty) => duty.resolved && !duty.ignored);

  return duties;
}

/** What the visible occurrences come to, skipping the ones that will not be paid. */
export function sumPayableDuties(
  duties: (MarkedDuty & { expense?: { expense?: number } | null })[]
) {
  return duties
    .filter((duty) => !duty.ignored)
    .reduce((total, duty) => total + (duty.expense?.expense ?? 0), 0);
}
