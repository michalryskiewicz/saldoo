import Papa from 'papaparse';
import type { STRATEGY_PART } from '@/constant.ts';
import type { Locale } from '@/i18n.ts';
import {
  BYTE_ORDER_MARK,
  SHEET_DELIMITER,
  budgetPartLabel,
  sheetHeader,
} from '@/lib/saldoo-sheet/format.ts';

/** One payment as the sheet writes it: names rather than ids, because a person has to read it. */
export type SheetExportRow = {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  currency: string;
  category?: string;
  goal?: string;
  expense?: string;
  budgetPart?: STRATEGY_PART;
};

/**
 * A figure as the spreadsheet that opens this file expects it.
 *
 * Polish Excel reads `1234.56` as text and `1234,56` as a number; English Excel does the opposite.
 * The file already declares its language in the header, so it declares it here too — and the import
 * accepts both, so a file written in one language still reads in the other.
 *
 * No thousands separator, ever: it is the one thing that makes a figure ambiguous rather than merely
 * foreign, and nothing needs it to open the file.
 */
const money = (amount: number, locale: Locale): string =>
  locale === 'pl' ? amount.toFixed(2).replace('.', ',') : amount.toFixed(2);

/**
 * Transactions as one of Saldoo's own sheets, ready to hand to Excel or Sheets.
 *
 * Every column is written even where the payment has nothing in it, because a column that comes and
 * goes with the data is not a format — and on the way back, a *missing* column means "leave that
 * field alone" while an *empty cell* means "clear it". A file that dropped its empty columns would
 * come back saying the opposite of what it went out saying.
 *
 * The delete column is written empty for every row, which is what makes a round trip safe: a person
 * marks the rows they want gone, and the ones they did not touch say nothing.
 */
export const sheetCsv = (rows: readonly SheetExportRow[], locale: Locale): string => {
  const body = rows.map((row) => [
    row.id,
    row.transactionDate,
    row.description,
    money(row.amount, locale),
    row.currency,
    row.category ?? '',
    row.goal ?? '',
    row.expense ?? '',
    row.budgetPart ? budgetPartLabel(row.budgetPart, locale) : '',
    '',
  ]);

  const csv = Papa.unparse([sheetHeader(locale), ...body], { delimiter: SHEET_DELIMITER });

  // The mark goes on the front or Excel reads a UTF-8 file as the local code page, and every Polish
  // description arrives as mojibake in a file the person is about to edit and hand back.
  return `${BYTE_ORDER_MARK}${csv}`;
};
