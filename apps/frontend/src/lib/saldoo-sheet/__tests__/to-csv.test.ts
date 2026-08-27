import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { STRATEGY_PART } from '@/constant.ts';
import { BYTE_ORDER_MARK, SHEET_DELIMITER, sheetHeader } from '@/lib/saldoo-sheet/format.ts';
import { readSheet } from '@/lib/saldoo-sheet/read.ts';
import { sheetCsv, type SheetExportRow } from '@/lib/saldoo-sheet/to-csv.ts';

/**
 * The file we write, and the only property that matters about it: it reads back.
 *
 * "What comes out is what goes in" is the whole point of defining a format, so the tests that earn
 * their place here are the round trips. The rest — the mark, the delimiter — are the two things that
 * decide whether Excel opens the file at all, and both are invisible until somebody double-clicks.
 */

const ROW: SheetExportRow = {
  id: 'abc-123',
  transactionDate: '2026-07-02',
  description: 'Czynsz — wspólnota mieszkaniowa',
  amount: -2500.5,
  currency: 'PLN',
  category: 'Dom',
  expense: 'Czynsz',
  budgetPart: STRATEGY_PART.NEEDS,
};

const reread = (csv: string) => readSheet(Papa.parse(csv, { delimiter: SHEET_DELIMITER }).data as unknown[][]);

describe('the file Excel opens', () => {
  it('opens with the byte order mark, or every Polish description arrives as mojibake', () => {
    expect(sheetCsv([ROW], 'pl').startsWith(BYTE_ORDER_MARK)).toBe(true);
  });

  it('writes the header in the language the app is in', () => {
    expect(sheetCsv([], 'pl')).toContain(sheetHeader('pl').join(SHEET_DELIMITER));
    expect(sheetCsv([], 'en')).toContain(sheetHeader('en').join(SHEET_DELIMITER));
  });

  it('writes a comma decimal for Polish Excel and a dot for English', () => {
    expect(sheetCsv([ROW], 'pl')).toContain('-2500,50');
    expect(sheetCsv([ROW], 'en')).toContain('-2500.50');
  });

  it('leaves the delete column empty on every row, so a round trip deletes nothing', () => {
    const { rows } = reread(sheetCsv([ROW], 'pl'));

    expect(rows[0].deleted).toBe(false);
  });

  it('writes every column even where the payment has nothing in it', () => {
    // A column that comes and goes with the data is not a format — and on the way back a missing
    // column means "leave it alone" while an empty cell means "clear it".
    const { rows } = reread(sheetCsv([{ ...ROW, category: undefined, goal: undefined }], 'pl'));

    expect(rows[0].stated.category).toBe('');
    expect(rows[0].stated.goal).toBe('');
  });
});

describe('the round trip', () => {
  it('reads back what it wrote, in both languages', () => {
    for (const locale of ['pl', 'en'] as const) {
      const { rows, recognised } = reread(sheetCsv([ROW], locale));

      expect(recognised).toBe(true);
      expect(rows[0].id).toBe(ROW.id);
      expect(rows[0].stated.date).toBe(ROW.transactionDate);
      // Semicolons and an em dash inside a description are exactly what quoting is for.
      expect(rows[0].stated.description).toBe(ROW.description);
      expect(rows[0].stated.category).toBe('Dom');
      expect(rows[0].stated.expense).toBe('Czynsz');
    }
  });

  it('survives a description holding the delimiter itself', () => {
    const { rows } = reread(sheetCsv([{ ...ROW, description: 'Sklep; ul. Główna 3' }], 'pl'));

    expect(rows[0].stated.description).toBe('Sklep; ul. Główna 3');
  });

  it('reads a file written in Polish after the app is switched to English', () => {
    const { rows } = reread(sheetCsv([ROW], 'pl'));

    expect(rows[0].stated.budgetPart).toBe('Potrzeby');
  });
});
