import { DriveUnreachableError } from '@/database/sync/drive-file.gateway.ts';
import type { SyncStatus } from '@/database/sync/sync-status.store.ts';

export type SyncAttempt = { ok: true } | { ok: false; error: unknown };

/**
 * Turns how a sync attempt settled into where this device now stands.
 *
 * Only an unreachable Drive is treated as harmless: the data and the data key are
 * already on this device, so there is nothing to protect by locking the user out.
 * Everything else lands on `blocked` — a `RemoteDecryptionError` because a later
 * export would overwrite a backup whose key the user may still recover, and an
 * unrecognised failure because an unexplained one earns no more trust than a
 * known-bad one.
 */
export function decideSyncStatus(attempt: SyncAttempt): SyncStatus {
  if (attempt.ok) return 'synced';
  if (attempt.error instanceof DriveUnreachableError) return 'offline';

  return 'blocked';
}
