import type { BankCsvParser, ParsedTransaction, ParseResult, RawRow } from '@/lib/banks/contract.ts';
import { headerConfidence, parseAmount, statementRows } from '@/lib/banks/statement.ts';
import type { Currency } from '@/constant.ts';

/**
 * The orders a date can be written in, as a bank writes them rather than as a library names them.
 *
 * A closed list on purpose: a free-text pattern is a thing somebody gets subtly wrong once and then
 * imports a year of payments filed to the wrong month. Every entry here is unambiguous about which
 * number is the day.
 */
export const DATE_FORMATS = ['YYYY-MM-DD', 'DD.MM.YYYY', 'DD/MM/YYYY', 'DD-MM-YYYY', 'MM/DD/YYYY'] as const;

export type DateFormat = (typeof DATE_FORMATS)[number];

/** Which cell holds what, by position, because an unknown bank's column names mean nothing to us. */
export type ColumnMap = {
  date: number;
  description: number;
  /** One column of signed amounts. Absent when the file splits money in from money out. */
  amount?: number;
  /** Money leaving the account, written positive in its own column. */
  debit?: number;
  /** Money arriving, likewise. */
  credit?: number;
  currency?: number;
  counterparty?: number;
  balanceAfter?: number;
};

export type CsvMapping = {
  id: string;
  /** What the person called it — "mBank osobiste" — and what the import screen offers it as. */
  name: string;
  /** Bumped by whoever edits the mapping, so a re-import can be told from a re-reading. */
  version: number;
  encoding: string;
  delimiter: string;
  /**
   * The row that names the columns, kept as read.
   *
   * Two jobs: it says where the table starts, and it is what lets a saved mapping recognise the
   * next month's export by itself. A file with no header at all keeps this empty and starts at the
   * first row.
   */
  headerRow: string[];
  columns: ColumnMap;
  dateFormat: DateFormat;
  /** Used when the file states no currency, because a figure without one is not money. */
  currency?: Currency;
};

const PATTERN: Record<DateFormat, { order: [number, number, number]; separator: string }> = {
  'YYYY-MM-DD': { order: [0, 1, 2], separator: '-' },
  'DD.MM.YYYY': { order: [2, 1, 0], separator: '.' },
  'DD/MM/YYYY': { order: [2, 1, 0], separator: '/' },
  'DD-MM-YYYY': { order: [2, 1, 0], separator: '-' },
  'MM/DD/YYYY': { order: [2, 0, 1], separator: '/' },
};

/**
 * A date as the file writes it, as the rest of the app writes it: `YYYY-MM-DD`.
 *
 * Normalised here rather than stored raw, because every screen downstream reads a transaction's
 * date with `new Date(...)`, and `03/04/2026` means March in one country and April in another. The
 * person said which their bank means; keeping their answer means keeping it once, here.
 *
 * @returns nothing when the cell is not a date in the shape promised, so the row can be reported
 * rather than imported to a day nobody chose.
 */
export const parseStatementDate = (value: unknown, format: DateFormat): string | undefined => {
  if (typeof value !== 'string') return undefined;

  const { order, separator } = PATTERN[format];
  const parts = value.trim().split(separator);

  if (parts.length !== 3) return undefined;

  const [yearAt, monthAt, dayAt] = order;
  const year = parts[yearAt];
  const month = parts[monthAt].padStart(2, '0');
  const day = parts[dayAt].padStart(2, '0');

  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return undefined;

  const iso = `${year}-${month}-${day}`;

  // A shape that parses is not a date that exists: 31.02 passes every regex above.
  const asDate = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(asDate.getTime()) || asDate.toISOString().slice(0, 10) !== iso) return undefined;

  return iso;
};

/**
 * What one row says was paid, whether the file signs its amounts or splits them in two.
 *
 * A debit column holds money leaving the account written positive, which is the opposite of how
 * this app stores it — so it is negated, and a row that fills in both columns is read as the
 * difference rather than refused. Only a row where neither column holds a figure is unreadable.
 */
const amountFrom = (row: RawRow, columns: ColumnMap): number | undefined => {
  if (columns.amount !== undefined) return parseAmount(row[columns.amount]);

  const debit = columns.debit === undefined ? undefined : parseAmount(row[columns.debit]);
  const credit = columns.credit === undefined ? undefined : parseAmount(row[columns.credit]);

  if (debit === undefined && credit === undefined) return undefined;

  return (credit ?? 0) - (debit ?? 0);
};

const cell = (row: RawRow, at: number | undefined): string =>
  at === undefined ? '' : String(row[at] ?? '').trim();

/**
 * A parser built from what somebody said about their own bank's file.
 *
 * The same contract every shipped bank meets, which is the point: once a mapping exists, nothing
 * downstream — not the import screen, not detection, not the database — can tell a format Saldoo
 * ships from one a person described. Including detection, so next month's export from the same bank
 * is recognised without anybody opening the mapper again.
 */
export const parserFromMapping = (mapping: CsvMapping): BankCsvParser => ({
  id: `mapping:${mapping.id}`,
  displayName: mapping.name,
  version: mapping.version,
  encoding: mapping.encoding,
  delimiter: mapping.delimiter,
  detect: (rawRows) => (mapping.headerRow.length ? headerConfidence(rawRows, mapping.headerRow) : 0),
  parse: (rawRows) => {
    const rows = mapping.headerRow.length
      ? statementRows(rawRows, mapping.headerRow, [])
      : rawRows;

    const transactions: ParsedTransaction[] = [];
    const warnings: ParseResult['warnings'] = [];

    rows.forEach((row, index) => {
      // A trailing blank line is what every CSV ends with, and reporting it as a broken row would
      // teach people to ignore the report that #16 exists to make worth reading.
      if (row.every((value) => String(value ?? '').trim() === '')) return;

      const transactionDate = parseStatementDate(row[mapping.columns.date], mapping.dateFormat);

      if (!transactionDate) {
        warnings.push({ row: index + 1, reason: 'no-date' });
        return;
      }

      const amount = amountFrom(row, mapping.columns);

      if (amount === undefined) {
        warnings.push({ row: index + 1, reason: 'unreadable-amount' });
        return;
      }

      const counterparty = cell(row, mapping.columns.counterparty);
      const description = cell(row, mapping.columns.description);

      transactions.push({
        transactionDate,
        // The counterparty is joined onto the description rather than stored apart: this app has one
        // field for what a payment was, and a second one nothing reads would be a promise it does
        // not keep. It is dropped when the description already contains it.
        description:
          counterparty && !description.includes(counterparty)
            ? [description, counterparty].filter(Boolean).join(' — ')
            : description,
        amount,
        currency: ((cell(row, mapping.columns.currency) as Currency) || mapping.currency) ?? '',
        rawData: row,
      });
    });

    return { transactions, warnings };
  },
});
