import i18n, { type TranslationKey } from '@/i18n.ts';
import { formatFrequency } from '@/lib/formats.ts';
import { matchesSearch } from '@/lib/search.ts';
import type { DBExpense } from '@/database/expenses.ts';

/**
 * What this needs of a row, rather than which row type it came from — so the table keeps owning
 * `ExpenseRow` and this keeps its own tests down to the fields it actually reads.
 */
export type SearchableExpense = Pick<
  DBExpense,
  'description' | 'severity' | 'frequency' | 'execution' | 'strategyPart' | 'expense'
> & { tag?: { name?: string } };

/**
 * Everything about an expense that somebody might type when looking for it.
 *
 * The **rendered** words, not the stored values: a priority is kept as `HIGH` and read as
 * "Wysoki", and "wysoki" is what gets typed. Same for the recurrence and the strategy part. A
 * search over the raw enums would answer nothing to every word actually on the screen, which is
 * the trap that makes this worth a named function and a test.
 *
 * The amount goes in twice, formatted and raw: "1 980,00 zł" contains a non-breaking space that
 * nobody types, so searching "1980" has to reach the raw value.
 */
export const expenseSearchText = (row: SearchableExpense): string => {
  // `formatFrequency` answers "-" when it has nothing to say, and that is a mark for the reader
  // rather than a word about this expense. Left in, typing a hyphen would "match" every row that
  // happens to be missing a date.
  const recurrence = formatFrequency(row.execution, row.frequency);

  return [
    row.description,
    row.severity ? i18n.t(row.severity as TranslationKey) : '',
    row.frequency ? i18n.t(row.frequency as TranslationKey) : '',
    recurrence === '-' ? '' : recurrence,
    row.tag?.name,
    row.strategyPart ? i18n.t(row.strategyPart as TranslationKey) : '',
    String(row.expense ?? ''),
  ]
    .filter(Boolean)
    .join(' ');
};

/** The rows somebody is looking for. An empty query is not a filter and returns all of them. */
export const searchExpenses = <TRow extends SearchableExpense>(
  rows: TRow[],
  query: string
): TRow[] => rows.filter((row) => matchesSearch(expenseSearchText(row), query));
