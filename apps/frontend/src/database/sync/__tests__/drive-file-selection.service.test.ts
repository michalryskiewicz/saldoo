import { describe, it, expect } from 'vitest';
import { selectDriveFile } from '../drive-file-selection.service.ts';

const file = (id: string, size: number, modifiedTime: string) => ({
  id,
  size,
  modifiedTime,
  // Carried by the listing, but never part of choosing between candidates.
  version: '1',
});

describe('selectDriveFile', () => {
  it('has nothing to select from an empty folder', () => {
    expect(selectDriveFile([])).toBeNull();
  });

  it('selects the only candidate', () => {
    const only = file('a', 481, '2026-07-28T13:22:00.000Z');

    expect(selectDriveFile([only])).toBe(only);
  });

  it('ignores an empty duplicate in favour of the one that carries the vault', () => {
    // Drive allows several files to share a name and does not promise an order.
    // The 0-byte one is a write that never finished; picking it reads as "no vault"
    // and the fresh vault that follows overwrites the backup the real one opens.
    const abandoned = file('empty', 0, '2026-07-28T13:21:00.000Z');
    const real = file('real', 481, '2026-07-28T13:22:00.000Z');

    expect(selectDriveFile([abandoned, real])).toBe(real);
    expect(selectDriveFile([real, abandoned])).toBe(real);
  });

  it('selects the newest when several candidates carry content', () => {
    const older = file('older', 300, '2026-01-01T00:00:00.000Z');
    const newer = file('newer', 120, '2026-07-28T13:22:00.000Z');

    expect(selectDriveFile([older, newer])).toBe(newer);
  });

  it('still selects an empty file when every candidate is empty', () => {
    // Empty must reach the caller as empty, never as absent: only a folder holding
    // no such file at all is evidence that no vault was ever created.
    const older = file('older', 0, '2026-01-01T00:00:00.000Z');
    const newer = file('newer', 0, '2026-07-28T13:22:00.000Z');

    expect(selectDriveFile([older, newer])).toBe(newer);
  });
});
