import i18n, { type TranslationKey } from '@/i18n.ts';
import { formatDueDate } from '@/lib/formats.ts';
import { matchesSearch } from '@/lib/search.ts';

/**
 * What this needs of a row rather than which row type it came from, so the table keeps owning
 * its own type and these tests stay down to the fields actually read.
 */
export type SearchableDuty = {
  executionDate: Date | string;
  expense?: {
    description?: string;
    severity?: string | null;
    expense?: number;
  } | null;
};

/**
 * Everything about an occurrence somebody might type when looking for it.
 *
 * The **rendered** words, not the stored ones. A priority is kept as `HIGH` and read as
 * "Wysoki"; a due date is kept as a timestamp and read as "4 lip". Searching the stored values
 * would answer nothing to every word the table actually shows, which is the trap that makes
 * this worth a named function with a test.
 *
 * The amount goes in raw as well as formatted: "1 980,00 zł" carries a non-breaking space
 * nobody types, so "1980" has to reach the number underneath.
 */
export const dutySearchText = (row: SearchableDuty, today: Date): string =>
  [
    row.expense?.description,
    row.expense?.severity ? i18n.t(row.expense.severity as TranslationKey) : '',
    formatDueDate(row.executionDate, today),
    String(row.expense?.expense ?? ''),
  ]
    .filter(Boolean)
    .join(' ');

/** The occurrences somebody is looking for. An empty query is not a filter and returns all. */
export const searchDuties = <TRow extends SearchableDuty>(rows: TRow[], query: string): TRow[] => {
  const today = new Date();

  return rows.filter((row) => matchesSearch(dutySearchText(row, today), query));
};
