import { describe, expect, it } from 'vitest';
import { sheetHeader } from '@/lib/saldoo-sheet/format.ts';
import { readSheet, saldooSheetFormat } from '@/lib/saldoo-sheet/read.ts';

/**
 * Reading one of our own files as rows, which is all this does.
 *
 * Nothing is parsed here on purpose: a badly typed amount means three different things depending on
 * whether the row is new, an edit to a bank's figure, or being deleted, and only the write path
 * knows which. What this has to get right is the one distinction the file can express and the write
 * path cannot recover: a column that is missing against a cell that is empty.
 */

const file = (rows: unknown[][]) => [sheetHeader('pl'), ...rows];

describe('reading a sheet', () => {
  it('takes the id and the delete mark as instructions, and the rest as what the row states', () => {
    const { rows } = readSheet(
      file([['abc', '2026-07-02', 'Czynsz', '-2500,00', 'PLN', 'Dom', '', 'Czynsz', 'Potrzeby', '']])
    );

    expect(rows).toEqual([
      {
        row: 1,
        id: 'abc',
        deleted: false,
        stated: {
          date: '2026-07-02',
          description: 'Czynsz',
          amount: '-2500,00',
          currency: 'PLN',
          category: 'Dom',
          goal: '',
          expense: 'Czynsz',
          budgetPart: 'Potrzeby',
        },
      },
    ]);
  });

  it('has no id for a row somebody typed into the sheet themselves', () => {
    const { rows } = readSheet(file([['', '2026-07-02', 'Kawa', '-12', 'PLN', '', '', '', '', '']]));

    expect(rows[0].id).toBeUndefined();
  });

  it('treats anything at all in the delete column as the mark', () => {
    const { rows } = readSheet(
      file([
        ['a', '2026-07-02', 'x', '1', 'PLN', '', '', '', '', 'x'],
        ['b', '2026-07-02', 'y', '1', 'PLN', '', '', '', '', 'tak'],
        ['c', '2026-07-02', 'z', '1', 'PLN', '', '', '', '', ''],
      ])
    );

    expect(rows.map((row) => row.deleted)).toEqual([true, true, false]);
  });

  it('leaves a column the file does not have out of the row entirely', () => {
    // The whole reason this type is a partial map: a deleted column and a cleared cell are two
    // different gestures, and only the file can tell them apart.
    const { rows } = readSheet([
      ['id', 'data', 'opis', 'kwota'],
      ['a', '2026-07-02', 'Kawa', '-12'],
    ]);

    expect(rows[0].stated).toEqual({ date: '2026-07-02', description: 'Kawa', amount: '-12' });
    expect('category' in rows[0].stated).toBe(false);
  });

  it('keeps an emptied cell, because emptying one is somebody clearing that field', () => {
    const { rows } = readSheet(file([['a', '2026-07-02', 'Kawa', '-12', 'PLN', '', '', '', '', '']]));

    expect(rows[0].stated.category).toBe('');
  });

  it('numbers rows the way the person counts them, from the first row under the header', () => {
    const { rows } = readSheet(
      file([
        ['a', '2026-07-01', 'x', '1', 'PLN', '', '', '', '', ''],
        ['b', '2026-07-02', 'y', '2', 'PLN', '', '', '', '', ''],
      ])
    );

    expect(rows.map((row) => row.row)).toEqual([1, 2]);
  });

  it('skips the blank line every CSV ends with rather than reporting it', () => {
    const { rows } = readSheet(file([['a', '2026-07-01', 'x', '1', 'PLN', '', '', '', '', ''], ['']]));

    expect(rows).toHaveLength(1);
  });

  it('recognises nothing in a file that is not one of ours', () => {
    expect(readSheet([['Data transakcji', 'Tytuł'], ['2026-07-01', 'x']])).toEqual({
      rows: [],
      recognised: false,
    });
  });
});

describe('the format on the import screen', () => {
  it('reads its own header as certain and a bank statement as nothing', () => {
    expect(saldooSheetFormat.detect([sheetHeader('en')])).toBe(1);
    expect(saldooSheetFormat.detect([['Data transakcji']])).toBe(0);
  });

  it('carries no parse, because a row of it can ask for a deletion and that is not a payment', () => {
    expect('parse' in saldooSheetFormat).toBe(false);
  });
});
