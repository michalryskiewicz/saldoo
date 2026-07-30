import { documentDriveSync } from './document-drive.container.ts';
import { documentDb } from './document.container.ts';
import { createOutbox } from './outbox.ts';
import { createIndexedDbOutboxStore } from './outbox-store.ts';
import { asOutboxError } from './upload-failure.service.ts';

/** The lock name is shared by every tab of this origin, which is the whole point. */
const UPLOAD_LOCK = 'saldoo-drive-upload';

/**
 * Runs the upload as the only writer across every open tab.
 *
 * Each tab has its own outbox, so without this two tabs would drain concurrently onto
 * one Drive file and the later-finishing write could carry the older state. A Web Lock
 * is released when the tab that held it dies, which a heartbeat-based leader election
 * would have to detect and time out.
 *
 * Where locks are unavailable the upload still runs — a single writer is a
 * correctness improvement, not a precondition for syncing at all.
 */
async function asSoleWriter(work: () => Promise<void>): Promise<void> {
  if (!navigator.locks) return work();

  await navigator.locks.request(UPLOAD_LOCK, work);
}

export const outbox = createOutbox({
  store: createIndexedDbOutboxStore(documentDb),

  upload: () =>
    asSoleWriter(async () => {
      try {
        await documentDriveSync.sync();
      } catch (error) {
        // Tag the failure as transient or permanent before it reaches the outbox,
        // which deliberately knows nothing about Drive.
        throw asOutboxError(error);
      }
    }),

  schedule: (delayMs, run) => {
    setTimeout(run, delayMs);
  },
});
