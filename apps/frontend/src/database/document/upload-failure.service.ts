import { DriveAuthRequiredError } from '@/auth/google/drive-token.service.ts';
import { DriveUnreachableError } from '@/database/sync/drive-file.gateway.ts';
import { DriveRequestFailedError } from '@/database/sync/googleDriveUtils.ts';
import { RemoteDecryptionError, UnreadableBackupError } from '@/database/sync/vault-drive-sync.ts';
import type { OutboxFailure } from './outbox.ts';

/**
 * Decides whether a failed upload is worth trying again.
 *
 * The outbox knows nothing about HTTP on purpose, so the knowledge lives here. Drive
 * failures arrive wrapped in `DriveUnreachableError` — which exists so that "we could
 * not look" is never actioned as "there is nothing there" — so this reads through the
 * `cause` rather than asking the gateway to reshape its contract.
 *
 * **Transient** means the condition can clear without anybody doing anything: offline,
 * rate limited, Drive having a bad day, a token that silent renewal may still get.
 *
 * **Permanent** means retrying would send the same bytes to the same rejection, and
 * only the user can change the outcome — a backup this version cannot read, or a
 * request Drive refuses outright.
 */
export function classifyUploadFailure(error: unknown): OutboxFailure {
  // Nothing the user can do about a backup we cannot open, and nothing a retry fixes.
  if (error instanceof UnreadableBackupError || error instanceof RemoteDecryptionError) {
    return 'permanent';
  }

  const cause = error instanceof DriveUnreachableError ? error.cause : error;

  // Authorization may come back on its own through silent renewal, and the fallback
  // button is there when it does not.
  if (cause instanceof DriveAuthRequiredError) return 'transient';

  if (cause instanceof DriveRequestFailedError) {
    const retryable = cause.status === 408 || cause.status === 429 || cause.status >= 500;
    return retryable ? 'transient' : 'permanent';
  }

  // Everything else — a network error, or something nobody has classified yet. Retrying
  // behind the backoff ceiling costs little; calling an unknown failure permanent would
  // strand the user's data locally under a message telling them to act on a diagnosis
  // nobody made.
  return 'transient';
}

/** Attaches the verdict in the shape the outbox reads. */
export function asOutboxError(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) {
    return Object.assign(new Error(String(error)), { transient: true });
  }

  return Object.assign(error, { transient: classifyUploadFailure(error) === 'transient' });
}
