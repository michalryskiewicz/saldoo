import { describe, expect, it } from 'vitest';
import { STRATEGY_PART } from '@/constant.ts';
import { ING_HEADER_ROW } from '@/lib/banks/ing.ts';
import {
  budgetPartFrom,
  budgetPartLabel,
  resolveColumns,
  sheetConfidence,
  sheetHeader,
  sheetTable,
} from '@/lib/saldoo-sheet/format.ts';

/**
 * The format itself: which spellings of a header we accept, and what a file has to have to be ours.
 *
 * The alias table is the round trip's only guarantee that a file written last year still opens. A
 * test on it is not a test of a helper — it is the compatibility promise, written down.
 */

describe('the header', () => {
  it('resolves every column from the Polish header it writes', () => {
    expect(resolveColumns(sheetHeader('pl'))).toEqual({
      id: 0,
      date: 1,
      description: 2,
      amount: 3,
      currency: 4,
      category: 5,
      goal: 6,
      expense: 7,
      budgetPart: 8,
      delete: 9,
    });
  });

  it('resolves every column from the English header too', () => {
    expect(Object.keys(resolveColumns(sheetHeader('en')))).toHaveLength(10);
  });

  it('reads a Polish file after the app has been switched to English, and the other way round', () => {
    // Decision 9. A header is a format, not copy: somebody who changes the language must not be
    // locked out of the files they already have.
    for (const header of [sheetHeader('pl'), sheetHeader('en')]) {
      expect(sheetConfidence([header])).toBe(1);
    }
  });

  it('does not mind case, padding or missing Polish diacritics', () => {
    const mangled = ['ID', ' Data ', 'OPIS', 'Kwota', 'waluta', 'Kategoria', 'Cel', 'Koszt', 'Czesc budzetu', 'Usun'];

    expect(Object.keys(resolveColumns(mangled))).toHaveLength(10);
  });

  it('keeps the first of two columns with the same name rather than refusing the file', () => {
    expect(resolveColumns(['id', 'data', 'opis', 'kwota', 'opis'])).toMatchObject({ description: 2 });
  });
});

describe('recognising one of our own files', () => {
  it('is certain, or nothing at all', () => {
    // A bank's score is a gradient because a bank's header drifts. Ours does not: we write it.
    expect(sheetConfidence([sheetHeader('pl')])).toBe(1);
    expect(sheetConfidence([ING_HEADER_ROW])).toBe(0);
  });

  it('refuses a file with no id column, whatever else it has', () => {
    // Without ids there is no round trip, only a second copy of everything in the file.
    expect(sheetConfidence([['data', 'opis', 'kwota', 'waluta']])).toBe(0);
  });

  it('finds the header below a note somebody left above the table', () => {
    const table = sheetTable([['moje transakcje'], [], sheetHeader('pl'), ['x', '2026-07-01']]);

    expect(table?.rows).toEqual([['x', '2026-07-01']]);
  });

  it('has no table at all when nothing in the file names our columns', () => {
    expect(sheetTable([ING_HEADER_ROW, ['2026-07-01']])).toBeUndefined();
  });
});

describe('the part of the budget a payment meets', () => {
  it('reads back what it wrote, in either language', () => {
    for (const part of Object.values(STRATEGY_PART)) {
      expect(budgetPartFrom(budgetPartLabel(part, 'pl'))).toBe(part);
      expect(budgetPartFrom(budgetPartLabel(part, 'en'))).toBe(part);
    }
  });

  it('accepts the name the code uses, for a file written by hand or by a script', () => {
    expect(budgetPartFrom('NEEDS')).toBe(STRATEGY_PART.NEEDS);
    expect(budgetPartFrom('needs')).toBe(STRATEGY_PART.NEEDS);
  });

  it('says nothing about a cell no strategy has a part for, so it can be reported', () => {
    expect(budgetPartFrom('rozrywka')).toBeUndefined();
  });
});
