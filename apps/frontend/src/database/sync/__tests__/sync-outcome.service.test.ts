import { describe, it, expect } from 'vitest';
import { decideSyncStatus } from '../sync-outcome.service.ts';
import { DriveUnreachableError } from '../drive-file.gateway.ts';
import { RemoteDecryptionError } from '../vault-drive-sync.ts';

describe('decideSyncStatus', () => {
  it('reports a completed sync', () => {
    expect(decideSyncStatus({ ok: true })).toBe('synced');
  });

  it('reports offline rather than a failure when Drive could not be reached', () => {
    // The point of the slice: the data and the key are already on this device, so
    // being offline is a status to show, not a reason to lock the user out of
    // their own records.
    expect(decideSyncStatus({ ok: false, error: new DriveUnreachableError() })).toBe('offline');
  });

  it('blocks when the backup cannot be decrypted', () => {
    // Carrying on would let a later export overwrite a backup whose key the user
    // may still be able to recover.
    expect(decideSyncStatus({ ok: false, error: new RemoteDecryptionError() })).toBe('blocked');
  });

  it('blocks on a failure it does not recognise', () => {
    expect(decideSyncStatus({ ok: false, error: new Error('something else') })).toBe('blocked');
  });

  it('treats a non-error rejection as unrecognised rather than harmless', () => {
    expect(decideSyncStatus({ ok: false, error: 'nope' })).toBe('blocked');
  });
});
