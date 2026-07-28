import { describe, it, expect } from 'vitest';
import { decideSync, NO_REMOTE_TIMESTAMP } from '../sync-decision.service.ts';

describe('decideSync', () => {
  it('imports onto a fresh device when Drive holds data', () => {
    expect(
      decideSync({ isLocalEmpty: true, localLastModified: -1, remoteLastModified: 1_000 })
    ).toBe('import');
  });

  it('exports when this device has data and Drive has none', () => {
    expect(
      decideSync({
        isLocalEmpty: false,
        localLastModified: 1_000,
        remoteLastModified: NO_REMOTE_TIMESTAMP,
      })
    ).toBe('export');
  });

  it('does nothing when neither side has anything', () => {
    expect(
      decideSync({
        isLocalEmpty: true,
        localLastModified: -1,
        remoteLastModified: NO_REMOTE_TIMESTAMP,
      })
    ).toBe('none');
  });

  it('imports when Drive is newer', () => {
    expect(
      decideSync({ isLocalEmpty: false, localLastModified: 1_000, remoteLastModified: 2_000 })
    ).toBe('import');
  });

  it('exports when this device is newer', () => {
    expect(
      decideSync({ isLocalEmpty: false, localLastModified: 2_000, remoteLastModified: 1_000 })
    ).toBe('export');
  });

  it('does nothing when both sides are at the same revision', () => {
    expect(
      decideSync({ isLocalEmpty: false, localLastModified: 1_000, remoteLastModified: 1_000 })
    ).toBe('none');
  });

  it('never exports an empty device over a good remote copy', () => {
    expect(
      decideSync({ isLocalEmpty: true, localLastModified: 5_000, remoteLastModified: 1_000 })
    ).toBe('import');
  });

  it('treats a zero remote timestamp as data worth comparing, not as absence', () => {
    expect(
      decideSync({ isLocalEmpty: false, localLastModified: -1, remoteLastModified: 0 })
    ).toBe('import');
  });
});
