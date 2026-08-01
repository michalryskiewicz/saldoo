import i18n, { type TranslationKey } from '@/i18n.ts';
import { formatDate } from '@/lib/formats.ts';
import { matchesSearch } from '@/lib/search.ts';
import type { DBTransaction } from '@/database/transactions.ts';

/**
 * What this needs of a row, rather than which row type it came from — so the table keeps owning
 * `TransactionRow` and this keeps its tests down to the fields it actually reads.
 */
export type SearchableTransaction = Pick<
  DBTransaction,
  'description' | 'amount' | 'transactionDate' | 'strategyPart'
> & { tag?: { name?: string }; expense?: { description?: string } };

/**
 * Everything about a payment that somebody might type when looking for it.
 *
 * The **rendered** words, not the stored values. Two of these columns are the whole reason the
 * search is worth having here: a payment is filed under a category and against a planned expense,
 * and neither word appears anywhere in the title the bank wrote. Looking for "everything I spent
 * on food" means typing the category, which the title never contains.
 *
 * The date goes in as the column writes it, and the amount raw: "12 500,00 zł" carries a
 * non-breaking space that nobody types, so "12500" has to reach the stored number.
 */
export const transactionSearchText = (row: SearchableTransaction): string =>
  [
    row.description,
    row.transactionDate ? formatDate(row.transactionDate) : '',
    row.tag?.name,
    row.strategyPart ? i18n.t(row.strategyPart as TranslationKey) : '',
    row.expense?.description,
    String(row.amount ?? ''),
  ]
    .filter(Boolean)
    .join(' ');

/** The rows somebody is looking for. An empty query is not a filter and returns all of them. */
export const searchTransactions = <TRow extends SearchableTransaction>(
  rows: TRow[],
  query: string
): TRow[] => rows.filter((row) => matchesSearch(transactionSearchText(row), query));
