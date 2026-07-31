import { ConcurrentWritesError } from '@/database/document/document-drive-sync.ts';
import { DriveUnreachableError } from '@/database/sync/drive-file.gateway.ts';
import { UnreadableBackupError } from '@/database/sync/vault-drive-sync.ts';
import type { SyncStatus } from '@/database/sync/sync-status.store.ts';

export type SyncAttempt = { ok: true } | { ok: false; error: unknown };

/**
 * Turns how a sync attempt settled into where this device now stands.
 *
 * Only an unreachable Drive is treated as harmless: the data and the data key are
 * already on this device, so there is nothing to protect by locking the user out.
 *
 * `unreadable-backup` is separated from `blocked` for one reason: it is the only
 * halt the user can clear themselves, and only if the screen names the file and the
 * fix. Everything else lands on `blocked` — a `RemoteDecryptionError` because a
 * later export would overwrite a backup whose key the user may still recover, and
 * an unrecognised failure because an unexplained one earns no more trust than a
 * known-bad one.
 */
export function decideSyncStatus(attempt: SyncAttempt): SyncStatus {
  if (attempt.ok) return 'synced';
  if (attempt.error instanceof DriveUnreachableError) return 'offline';
  // Contention is not a halt: nothing is lost, the local document still holds everything,
  // and the outbox is what tells the user a change has not left the device yet. Blocking
  // the whole app behind a full-screen warning because another device also wrote would be
  // alarming and wrong.
  if (attempt.error instanceof ConcurrentWritesError) return 'idle';
  if (attempt.error instanceof UnreadableBackupError) return 'unreadable-backup';

  return 'blocked';
}
