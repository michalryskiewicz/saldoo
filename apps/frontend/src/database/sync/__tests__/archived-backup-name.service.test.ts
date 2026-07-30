import { describe, it, expect } from 'vitest';
import { archivedBackupName } from '../archived-backup-name.service.ts';

describe('archivedBackupName', () => {
  it('keeps the extension so Drive still shows a JSON file', () => {
    expect(archivedBackupName('saldoo-data.json')).toBe('saldoo-data.legacy.json');
  });

  it('appends the marker when the name carries no extension', () => {
    expect(archivedBackupName('saldoo-data')).toBe('saldoo-data.legacy');
  });

  it('marks only the last extension of a multi-dotted name', () => {
    expect(archivedBackupName('saldoo.data.v2.json')).toBe('saldoo.data.v2.legacy.json');
  });
});
