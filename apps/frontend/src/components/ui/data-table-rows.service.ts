import { TOTAL } from '@/constant.ts';

/**
 * The summary row is shaped like a record so the table can render it through the same columns,
 * which means everything that counts or places rows has to be told it is not one.
 *
 * Both callers used to know this independently: the table knew enough to keep the total out of
 * the sort, and the footer did not, so it counted the summary as a sixth expense when there were
 * five.
 */

type TableRow = { original: unknown };

export const isTotalRow = (row: TableRow): boolean =>
  (row.original as { id?: string } | null)?.id === TOTAL;

/**
 * The records, and the summary held separately.
 *
 * Separated rather than sorted to the end, because the two belong in different elements: records
 * are `tbody` and a summary is `tfoot`. Appending it to the body worked only for as long as
 * nothing else reordered the body — and sorting is exactly a thing that reorders the body, which
 * is how a total once landed in the middle of the rows it totals.
 */
export const partitionTotalRow = <TRow extends TableRow>(
  rows: TRow[]
): { records: TRow[]; total?: TRow } => ({
  records: rows.filter((row) => !isTotalRow(row)),
  total: rows.find(isTotalRow),
});

/** How many records the table is showing — which is not how many rows it renders. */
export const countRecords = (rows: TableRow[]): number =>
  rows.filter((row) => !isTotalRow(row)).length;
