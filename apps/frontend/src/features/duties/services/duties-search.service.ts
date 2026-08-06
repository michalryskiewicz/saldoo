import i18n from '@/i18n.ts';
import { formatDueDate } from '@/lib/formats.ts';
import { matchesSearch } from '@/lib/search.ts';
import { survivesIncomeLoss } from '@/lib/safety-net.ts';
import type { SEVERITY } from '@/constant.ts';
import type { DBExpense } from '@/database/expenses.ts';

/**
 * What this needs of a row rather than which row type it came from, so the table keeps owning
 * its own type and these tests stay down to the fields actually read.
 */
export type SearchableDuty = {
  executionDate: Date | string;
  /** What the row shows, which is not always what the cost holds — see `duty-price.service`. */
  price?: number;
  expense?: {
    description?: string;
    severity?: SEVERITY | null;
    survivesIncomeLoss?: boolean;
    expense?: number;
  } | null;
};

/**
 * Everything about an occurrence somebody might type when looking for it.
 *
 * The **rendered** words, not the stored ones. Whether a cost survives losing the income is kept
 * as a boolean and read as "Zostaje"; a due date is kept as a timestamp and read as "4 lip".
 * Searching the stored values would answer nothing to every word the table actually shows, which
 * is the trap that makes this worth a named function with a test.
 *
 * The amount goes in raw as well as formatted: "1 980,00 zł" carries a non-breaking space
 * nobody types, so "1980" has to reach the number underneath. The row's price, not the cost's
 * amount: a share of an income has none of its own, and a converted figure lives on the row.
 */
export const dutySearchText = (row: SearchableDuty, today: Date): string =>
  [
    row.expense?.description,
    row.expense
      ? i18n.t(
          survivesIncomeLoss(row.expense as DBExpense)
            ? 'cost_nature.irreducible'
            : 'cost_nature.reducible'
        )
      : '',
    formatDueDate(row.executionDate, today),
    String(row.price ?? ''),
  ]
    .filter(Boolean)
    .join(' ');

/** The occurrences somebody is looking for. An empty query is not a filter and returns all. */
export const searchDuties = <TRow extends SearchableDuty>(rows: TRow[], query: string): TRow[] => {
  const today = new Date();

  return rows.filter((row) => matchesSearch(dutySearchText(row, today), query));
};
