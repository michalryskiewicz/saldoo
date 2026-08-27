import { describe, it, expect } from 'vitest';
import {
  needsAttention,
  reportAsText,
  reportOf,
  rowsSeen,
  type ImportReport,
} from '../import-report.service';

const report = (overrides: Partial<ImportReport> = {}): ImportReport => ({
  imported: 3,
  duplicates: 0,
  repeatedInFile: 0,
  unreadable: [],
  notStored: 0,
  ...overrides,
});

describe('reportOf', () => {
  it('spans the payments it stored, earliest to latest, whatever order they arrived in', () => {
    const built = reportOf({
      ...report(),
      storedDates: ['2026-03-05', '2026-03-01', '2026-03-31'],
    });

    expect(built.from).toBe('2026-03-01');
    expect(built.to).toBe('2026-03-31');
  });

  it('claims no span when it stored nothing, rather than a span of nothing', () => {
    const built = reportOf({ ...report({ imported: 0, duplicates: 4 }), storedDates: [] });

    expect(built.from).toBeUndefined();
    expect(built.to).toBeUndefined();
  });
});

describe('rowsSeen', () => {
  it('adds up to what the file offered, however each row ended', () => {
    expect(
      rowsSeen(
        report({
          imported: 10,
          duplicates: 4,
          repeatedInFile: 1,
          unreadable: [{ row: 7, reason: 'no-date' }],
          notStored: 2,
        })
      )
    ).toBe(18);
  });
});

describe('needsAttention', () => {
  it('is quiet about duplicates, which are what re-uploading a month is supposed to produce', () => {
    expect(needsAttention(report({ imported: 0, duplicates: 132 }))).toBe(false);
  });

  it('speaks up for a row that could not be read', () => {
    expect(needsAttention(report({ unreadable: [{ row: 3, reason: 'unreadable-amount' }] }))).toBe(
      true
    );
  });

  it('speaks up for a row that was read and then not stored', () => {
    expect(needsAttention(report({ notStored: 1 }))).toBe(true);
  });
});

describe('reportAsText', () => {
  const text = reportAsText(
    reportOf({
      ...report({
        imported: 2,
        duplicates: 1,
        unreadable: [{ row: 9, reason: 'no-date' }],
      }),
      storedDates: ['2026-03-04', '2026-03-05'],
    }),
    { bank: 'ING Bank Śląski', fileName: 'marzec.csv' }
  );

  it('says what happened, in full', () => {
    expect(text).toContain('Imported: 2');
    expect(text).toContain('Already held: 1');
    expect(text).toContain('Covering: 2026-03-04 to 2026-03-05');
    expect(text).toContain('row 9: no-date');
  });

  it('names rows and reasons and never what was paid or to whom', () => {
    expect(text).not.toMatch(/BIEDRONKA|\d+,\d{2}/);
  });
});
