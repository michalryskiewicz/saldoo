import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { ingParser } from '../ing';
import { pkobpParser } from '../pkobp';
import type { RawRow } from '../contract';

const STATEMENT = `Preamble line
Header info

Data transakcji;Data księgowania;Dane kontrahenta;Tytuł;Nr rachunku;Nazwa banku;Szczegóły;Nr transakcji;Kwota transakcji (waluta rachunku);Waluta;Kwota blokady/zwolnienie blokady;Waluta;Kwota płatności w walucie;Waluta;Konto;Bank;Saldo po transakcji;Waluta;;;
2025-12-09;2025-12-09;Test Kontrahent;Test Title;;;Details;TRX123;-100,50;PLN;;;;Test Account;Test Bank;1000,00;PLN;;;
2025-12-08;2025-12-08;Another One;Another Title;;;Details;TRX124;50,25;EUR;;;;Account2;Bank2;2000,00;EUR;;;

Dokument ma charakter informacyjny, nie stanowi dowodu księgowego;
Footer line`;

const rowsOf = (csv: string, delimiter: string): RawRow[] =>
  Papa.parse<RawRow>(csv, { delimiter }).data;

describe('ING parser', () => {
  const rows = rowsOf(STATEMENT, ingParser.delimiter);

  it('reads the payments out of a statement that is mostly not payments', () => {
    const { transactions, warnings } = ingParser.parse(rows);

    expect(transactions).toHaveLength(2);
    expect(warnings).toEqual([]);

    expect(transactions[0]).toMatchObject({
      transactionDate: '2025-12-09',
      description: 'Test Title',
      transactionId: 'TRX123',
      amount: -100.5,
      currency: 'PLN',
    });

    expect(transactions[1]).toMatchObject({
      transactionDate: '2025-12-08',
      description: 'Another Title',
      transactionId: 'TRX124',
      amount: 50.25,
      currency: 'EUR',
    });
  });

  it('keeps the original row, because the hash that de-duplicates an import is taken over it', () => {
    const [first] = ingParser.parse(rows).transactions;

    expect(first.rawData[0]).toBe('2025-12-09');
    expect(first.rawData[8]).toBe('-100,50');
  });

  it('says which row it could not read instead of importing a payment of nought', () => {
    const withBadAmount = STATEMENT.replace('-100,50', 'brak danych');

    const { transactions, warnings } = ingParser.parse(rowsOf(withBadAmount, ingParser.delimiter));

    expect(transactions).toHaveLength(1);
    expect(warnings).toEqual([{ row: 1, reason: 'unreadable-amount' }]);
  });

  it('passes over a row with no date at all', () => {
    const undated = STATEMENT.replace('2025-12-09;2025-12-09;Test Kontrahent', ';;Test Kontrahent');

    const { transactions, warnings } = ingParser.parse(rowsOf(undated, ingParser.delimiter));

    expect(transactions).toHaveLength(1);
    expect(warnings).toEqual([{ row: 1, reason: 'no-date' }]);
  });

  describe('detect', () => {
    it('is certain about its own bank', () => {
      expect(ingParser.detect(rows)).toBe(1);
    });

    it('does not claim a file another bank wrote', () => {
      expect(pkobpParser.detect(rows)).toBeLessThan(1);
    });
  });
});
