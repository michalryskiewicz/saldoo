import i18n, { type TranslationKey } from '@/i18n.ts';
import { formatRecurrence } from '@/lib/formats.ts';
import { matchesSearch } from '@/lib/search.ts';
import type { DBProfit } from '@/database/profits.ts';

/**
 * What this needs of a row, rather than which row type it came from — so the table keeps owning
 * its own row type and this keeps its tests down to the fields it actually reads.
 */
export type SearchableProfit = Pick<DBProfit, 'description' | 'profit' | 'frequency' | 'execution'>;

/**
 * Everything about a profit that somebody might type when looking for it.
 *
 * The **rendered** words, not the stored values: a recurrence is kept as `MONTHLY` and read as
 * "15. dnia miesiąca", and that phrase is what is on the screen to be typed back. A search over
 * the raw enums would answer nothing to every word actually visible.
 *
 * The amount goes in raw rather than formatted: "12 500,00 zł" contains a non-breaking space
 * that nobody types, so "12500" has to reach the stored number.
 */
export const profitSearchText = (row: SearchableProfit): string => {
  // `formatRecurrence` answers "-" when it has nothing to say, and that is a mark for the reader
  // rather than a word about this profit. Left in, typing a hyphen would "match" every row that
  // happens to be missing a date.
  const recurrence = formatRecurrence(row.execution, row.frequency);

  return [
    row.description,
    row.frequency ? i18n.t(row.frequency as TranslationKey) : '',
    recurrence === '-' ? '' : recurrence,
    String(row.profit ?? ''),
  ]
    .filter(Boolean)
    .join(' ');
};

/** The rows somebody is looking for. An empty query is not a filter and returns all of them. */
export const searchProfits = <TRow extends SearchableProfit>(rows: TRow[], query: string): TRow[] =>
  rows.filter((row) => matchesSearch(profitSearchText(row), query));
