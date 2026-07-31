import {
  decryptBytesWithDek,
  encryptBytesWithDek,
  type EncryptedPayload,
} from '@/crypto/vault.service.ts';
import {
  RemoteMovedOnError,
  type VersionedDriveFile,
} from '@/database/sync/versioned-drive-file.gateway.ts';
import type { DocumentSession } from './document-session.ts';
import type { RemoteVersionStore } from './remote-version.store.ts';

/**
 * A **new** file rather than the pre-document `saldoo-data.json`.
 *
 * The payload is a Yjs update, not a Dexie export, so an older build reading it would
 * find nothing it recognises — and this way it never has to. The old file is left
 * exactly where it is.
 */
export const DOCUMENT_FILE = 'saldoo-document-v1.json';

/**
 * How many times a pass will re-merge and try again before giving up for now.
 *
 * Bounded because the loop is driven by *other devices writing*: unbounded, two devices
 * syncing in a tight loop could keep each other going indefinitely. Three clears any
 * realistic burst, and giving up is cheap — the work is still owed and the outbox comes
 * back to it behind its backoff.
 */
export const MAX_SYNC_ATTEMPTS = 3;

/**
 * Raised when the remote kept moving under this device for {@link MAX_SYNC_ATTEMPTS} passes.
 *
 * Not a failure of anything: it means another device is writing too. Nothing is lost — the
 * local document is the truth and still holds everything — so this is classified transient
 * and retried, and never surfaced as a halt.
 */
export class ConcurrentWritesError extends Error {
  constructor(readonly attempts: number) {
    super(`The remote moved on ${attempts} times in a row, so this pass gave up`);
    this.name = 'ConcurrentWritesError';
  }
}

/**
 * Raised when Drive holds bytes that are not a document this device can open: empty,
 * unparseable, or sealed under a different key.
 *
 * It exists so that "we cannot read this" is never actioned as "there is nothing
 * there". The second verdict would upload over whatever is actually in the file.
 */
export class UnreadableDocumentError extends Error {
  constructor(cause?: unknown) {
    super('The document on Drive could not be read, so it must not be overwritten');
    this.name = 'UnreadableDocumentError';
    this.cause = cause;
  }
}

export interface DocumentDriveSync {
  /**
   * Brings this device and Drive level, and publishes nothing that has not absorbed what
   * Drive holds.
   *
   * Merging is commutative, so whichever device syncs first, both end up with everything.
   * What merging alone does not prevent is this device's upload landing on top of a write
   * another device made between the read and the write — which is what the version
   * precondition and the read-back after the write are for.
   */
  sync(): Promise<void>;
}

export function createDocumentDriveSync(
  drive: VersionedDriveFile,
  session: DocumentSession,
  requireDek: () => CryptoKey,
  versions: RemoteVersionStore
): DocumentDriveSync {
  /** @throws {UnreadableDocumentError} — never returns "nothing there" for "cannot read". */
  const decode = async (raw: string): Promise<Uint8Array> => {
    if (raw.trim() === '') throw new UnreadableDocumentError();

    let payload: EncryptedPayload;
    try {
      payload = JSON.parse(raw) as EncryptedPayload;
    } catch (error) {
      throw new UnreadableDocumentError(error);
    }

    try {
      return await decryptBytesWithDek(requireDek(), payload);
    } catch (error) {
      throw new UnreadableDocumentError(error);
    }
  };

  const encode = async (): Promise<string> =>
    JSON.stringify(await encryptBytesWithDek(requireDek(), session.encode()));

  return {
    async sync() {
      /**
       * The remote version whose contents this device has taken in — either merged or
       * written itself. It is the read's "no need to download" token *and* the write's
       * precondition, and those are only the same value because it is never set to a
       * version this device has not absorbed.
       */
      let absorbed = await versions.read(DOCUMENT_FILE);

      for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt++) {
        const remote = await drive.read(DOCUMENT_FILE, absorbed);

        if (remote.status === 'absent') {
          // A version remembered against a file that is gone would have every later write
          // rejected forever.
          await versions.forget(DOCUMENT_FILE);
          absorbed = null;
        } else {
          // `unchanged` carries no content precisely because none was downloaded.
          if (remote.status === 'content') await session.merge(await decode(remote.content));
          absorbed = remote.version;
        }

        let published: string;
        try {
          published = await drive.write(DOCUMENT_FILE, await encode(), absorbed);
        } catch (error) {
          if (!(error instanceof RemoteMovedOnError)) throw error;

          // Rejected before anything was uploaded, so nothing of the other device's is at
          // risk. `error.found` is deliberately NOT adopted here: it names a version whose
          // contents this device has never seen, and taking it would make the next read
          // report "unchanged", skip the download, and publish a document that had not
          // absorbed the write that caused the rejection in the first place.
          continue;
        }

        await versions.write(DOCUMENT_FILE, published);

        // The write itself is unguarded — Drive documents no precondition on a media upload,
        // so the check before it is a read followed by an unguarded write — and this read-back
        // is what closes the window that leaves. A remote no longer at the version this write
        // produced means somebody landed one in between and this upload may have replaced
        // their state. Their update is still on Drive to be merged and this device's is still
        // local, so going round again publishes both.
        const after = await drive.read(DOCUMENT_FILE, published);
        if (after.status === 'unchanged') return;

        if (after.status === 'absent') {
          await versions.forget(DOCUMENT_FILE);
          absorbed = null;
        } else {
          await session.merge(await decode(after.content));
          absorbed = after.version;
        }
      }

      throw new ConcurrentWritesError(MAX_SYNC_ATTEMPTS);
    },
  };
}
