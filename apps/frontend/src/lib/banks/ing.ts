import type { BankCsvParser, ParsedTransaction, ParseResult, RawRow } from '@/lib/banks/contract.ts';
import { headerConfidence, parseAmount, statementRows } from '@/lib/banks/statement.ts';
import type { Currency } from '@/constant.ts';

export const ING_HEADER_ROW = [
  'Data transakcji',
  'Data księgowania',
  'Dane kontrahenta',
  'Tytuł',
  'Nr rachunku',
  'Nazwa banku',
  'Szczegóły',
  'Nr transakcji',
  'Kwota transakcji (waluta rachunku)',
  'Waluta',
  'Kwota blokady/zwolnienie blokady',
  'Waluta',
  'Kwota płatności w walucie',
  'Waluta',
  'Konto',
  'Bank',
  'Saldo po transakcji',
  'Waluta',
  '',
  '',
  '',
];

export const ING_STOP_ROWS = [
  [''],
  ['Dokument ma charakter informacyjny, nie stanowi dowodu księgowego', ''],
];

/** Which cell holds what, named once, where the header they belong to is also written down. */
const COLUMN = {
  date: 0,
  title: 3,
  reference: 7,
  amount: 8,
  currency: 9,
} as const;

const parseRows = (rawRows: RawRow[]): ParseResult => {
  const transactions: ParsedTransaction[] = [];
  const warnings: ParseResult['warnings'] = [];

  statementRows(rawRows, ING_HEADER_ROW, ING_STOP_ROWS).forEach((row, index) => {
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
      description: (row[COLUMN.title] as string) || '',
      amount,
      currency: (row[COLUMN.currency] as Currency) || '',
      transactionId: (row[COLUMN.reference] as string) || undefined,
      rawData: row,
    });
  });

  return { transactions, warnings };
};

/**
 * ING Bank Śląski, which exports cp1250 with semicolons and a nineteen-column header.
 *
 * The only bank here that prints its own reference per payment, which is why `transactionId` is
 * optional on the contract rather than required of everybody.
 */
export const ingParser: BankCsvParser = {
  id: 'ING',
  displayName: 'ING Bank Śląski',
  version: 1,
  encoding: 'cp1250',
  delimiter: ';',
  detect: (rawRows) => headerConfidence(rawRows, ING_HEADER_ROW),
  parse: parseRows,
};
