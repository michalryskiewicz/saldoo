import { describe, it, expect } from 'vitest';
import { readLastUpdatedFromSnapshot } from '../remote-snapshot.service.ts';
import { NO_REMOTE_TIMESTAMP } from '../sync-decision.service.ts';

const snapshot = (rows: { key: string; value: string | number }[]) =>
  JSON.stringify({
    data: {
      databaseName: 'saldoo',
      databaseVersion: 2,
      data: [
        { inbound: true, tableName: 'expenses', rows: [] },
        { inbound: true, tableName: 'meta', rows },
      ],
    },
    name: 'saldoo',
    formatVersion: 1,
  });

describe('readLastUpdatedFromSnapshot', () => {
  it('reads the lastUpdated stamp out of the meta table', () => {
    expect(readLastUpdatedFromSnapshot(snapshot([{ key: 'lastUpdated', value: 1_700_000 }]))).toBe(
      1_700_000
    );
  });

  it('ignores unrelated meta rows', () => {
    const json = snapshot([
      { key: 'somethingElse', value: 'x' },
      { key: 'lastUpdated', value: 42 },
    ]);

    expect(readLastUpdatedFromSnapshot(json)).toBe(42);
  });

  it('reports no timestamp when the meta table has no lastUpdated row', () => {
    expect(readLastUpdatedFromSnapshot(snapshot([]))).toBe(NO_REMOTE_TIMESTAMP);
  });

  it('reports no timestamp when lastUpdated is not a number', () => {
    const json = snapshot([{ key: 'lastUpdated', value: 'yesterday' }]);

    expect(readLastUpdatedFromSnapshot(json)).toBe(NO_REMOTE_TIMESTAMP);
  });

  it('reports no timestamp when there is no meta table at all', () => {
    const json = JSON.stringify({ data: { data: [{ tableName: 'expenses', rows: [] }] } });

    expect(readLastUpdatedFromSnapshot(json)).toBe(NO_REMOTE_TIMESTAMP);
  });

  it('reports no timestamp for content that is not a Saldoo export', () => {
    expect(readLastUpdatedFromSnapshot(JSON.stringify({ unrelated: true }))).toBe(
      NO_REMOTE_TIMESTAMP
    );
  });

  it('reports no timestamp for content that is not JSON', () => {
    expect(readLastUpdatedFromSnapshot('not-json-at-all')).toBe(NO_REMOTE_TIMESTAMP);
  });

  it('reports no timestamp for an empty string', () => {
    expect(readLastUpdatedFromSnapshot('')).toBe(NO_REMOTE_TIMESTAMP);
  });
});
