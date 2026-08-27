import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { pkobpParser } from '../pkobp';
import { ingParser } from '../ing';
import type { RawRow } from '../contract';

const STATEMENT = `"Data operacji","Data waluty","Typ transakcji","Kwota","Waluta","Opis transakcji","","","","",""
"2025-12-09","2025-12-09","Przelew","-250,00","PLN","Opis","część 1","część 2","","",""
"2025-12-08","2025-12-08","Zakup","-1 234,56","PLN","BIEDRONKA 1234","WARSZAWA","","","",""
""`;

const rowsOf = (csv: string): RawRow[] => Papa.parse<RawRow>(csv, { delimiter: pkobpParser.delimiter }).data;

describe('PKO BP parser', () => {
  const rows = rowsOf(STATEMENT);

  it('reads the payments, joining the tail of the row into one description', () => {
    const { transactions, warnings } = pkobpParser.parse(rows);

    expect(warnings).toEqual([]);
    expect(transactions).toHaveLength(2);

    expect(transactions[0]).toMatchObject({
      transactionDate: '2025-12-09',
      description: 'Opis część 1 część 2',
      amount: -250,
      currency: 'PLN',
    });
  });

  it('reads a thousands separator rather than losing the thousands', () => {
    expect(pkobpParser.parse(rows).transactions[1].amount).toBe(-1234.56);
  });

  it('prints no reference, because the bank does not', () => {
    expect(pkobpParser.parse(rows).transactions[0].transactionId).toBeUndefined();
  });

  describe('detect', () => {
    it('is certain about its own bank', () => {
      expect(pkobpParser.detect(rows)).toBe(1);
    });

    it('does not claim a file another bank wrote', () => {
      expect(ingParser.detect(rows)).toBeLessThan(1);
    });
  });
});
