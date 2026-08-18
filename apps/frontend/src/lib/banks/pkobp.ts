import type { BankCsvParser, ParsedTransaction, ParseResult, RawRow } from '@/lib/banks/contract.ts';
import { headerConfidence, parseAmount, statementRows } from '@/lib/banks/statement.ts';
import type { Currency } from '@/constant.ts';

export const PKOBP_HEADER_ROW = [
  'Data operacji',
  'Data waluty',
  'Typ transakcji',
  'Kwota',
  'Waluta',
  'Opis transakcji',
  '',
  '',
  '',
  '',
  '',
];

export const PKOBP_STOP_ROWS = [['']];

const COLUMN = {
  date: 0,
  amount: 3,
  currency: 4,
  /** Everything from here on is description: PKO BP spreads one payment's text over the tail. */
  descriptionFrom: 5,
} as const;

const parseRows = (rawRows: RawRow[]): ParseResult => {
  const transactions: ParsedTransaction[] = [];
  const warnings: ParseResult['warnings'] = [];

  statementRows(rawRows, PKOBP_HEADER_ROW, PKOBP_STOP_ROWS).forEach((row, index) => {
    const transactionDate = (row[COLUMN.date] as string) || '';
    const amount = parseAmount(row[COLUMN.amount]);

    if (!transactionDate) {
      warnings.push({ row: index + 1, reason: 'no-date' });
      return;
    }

    if (amount === undefined) {
      warnings.push({ row: index + 1, reason: 'unreadable-amount' });
      return;
    }

    transactions.push({
      transactionDate,
      description: row.slice(COLUMN.descriptionFrom).join(' ').trim(),
      amount,
      currency: (row[COLUMN.currency] as Currency) || '',
      rawData: row,
    });
  });

  return { transactions, warnings };
};

/**
 * PKO BP, which exports cp1250 with commas and no per-payment reference.
 *
 * Its description is not one cell but the tail of the row, joined — the bank splits a single
 * payment's text across as many columns as it needs and pads the rest.
 */
export const pkobpParser: BankCsvParser = {
  id: 'PKOBP',
  displayName: 'PKO BP',
  version: 1,
  encoding: 'cp1250',
  delimiter: ',',
  detect: (rawRows) => headerConfidence(rawRows, PKOBP_HEADER_ROW),
  parse: parseRows,
};
