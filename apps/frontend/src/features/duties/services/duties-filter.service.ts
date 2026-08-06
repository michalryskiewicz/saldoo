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

/**
 * What the visible occurrences come to, skipping the ones that will not be paid.
 *
 * Adds the price resolved onto the row, never the amount on the cost behind it. Those two differ
 * twice over: a share of an income has no amount on its record at all, and on a screen showing a
 * currency other than the one a cost was entered in the converted figure lives on the row, because
 * conversion cannot reach a figure nested inside the cost. Reading the nested one added złoty to
 * euro and called the result a total.
 */
export function sumPayableDuties(duties: (MarkedDuty & { price?: number })[]) {
  return duties
    .filter((duty) => !duty.ignored)
    .reduce((total, duty) => total + (duty.price ?? 0), 0);
}
