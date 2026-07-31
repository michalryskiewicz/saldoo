import { describe, expect, it } from 'vitest';
import { TOTAL } from '@/constant.ts';
import { countRecords, isTotalRow, partitionTotalRow } from '../data-table-rows.service.ts';

const record = (id: string) => ({ original: { id } });
const total = { original: { id: TOTAL } };

describe('isTotalRow', () => {
  it('recognises the summary row', () => {
    expect(isTotalRow(total)).toBe(true);
  });

  it('treats a record as a record', () => {
    expect(isTotalRow(record('abc'))).toBe(false);
  });

  it('survives a row whose original carries no id at all', () => {
    expect(isTotalRow({ original: {} })).toBe(false);
    expect(isTotalRow({ original: null })).toBe(false);
  });
});

describe('partitionTotalRow', () => {
  it('holds the summary apart from the records, wherever the sort put it', () => {
    const rows = [record('a'), total, record('b')];

    expect(partitionTotalRow(rows)).toEqual({ records: [record('a'), record('b')], total });
  });

  it('leaves the records in the order it was given them', () => {
    const rows = [record('c'), record('a'), record('b')];

    expect(partitionTotalRow(rows).records).toEqual(rows);
  });

  it('reports no summary when the table has none', () => {
    expect(partitionTotalRow([record('a')])).toEqual({ records: [record('a')], total: undefined });
  });

  it('copes with nothing at all', () => {
    expect(partitionTotalRow([])).toEqual({ records: [], total: undefined });
  });
});

describe('countRecords', () => {
  it('does not count the summary as a record', () => {
    expect(countRecords([record('a'), record('b'), total])).toBe(2);
  });

  it('counts nothing when the table holds only a summary', () => {
    expect(countRecords([total])).toBe(0);
  });

  it('counts nothing when the table is empty', () => {
    expect(countRecords([])).toBe(0);
  });
});
