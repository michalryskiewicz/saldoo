import {
  decryptBytesWithDek,
  encryptBytesWithDek,
  type EncryptedPayload,
} from '@/crypto/vault.service.ts';
import type { DriveFileGateway } from '@/database/sync/drive-file.gateway.ts';
import type { DocumentSession } from './document-session.ts';

/**
 * A **new** file rather than the pre-document `saldoo-data.json`.
 *
 * The payload is a Yjs update, not a Dexie export, so an older build reading it would
 * find nothing it recognises — and this way it never has to. The old file is left
 * exactly where it is.
 */
export const DOCUMENT_FILE = 'saldoo-document-v1.json';

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
   * Brings this device and Drive level in **one pass**: what is on Drive is merged in,
   * and the merged state goes back out.
   *
   * There is no import-or-export decision left to make. Merging is commutative, so
   * whichever device syncs first, both end up with everything — which is the whole
   * reason the whole-database last-writer-wins scheme is gone.
   */
  sync(): Promise<void>;
}

export function createDocumentDriveSync(
  drive: DriveFileGateway,
  session: DocumentSession,
  requireDek: () => CryptoKey,
): DocumentDriveSync {
  const readRemote = async (): Promise<Uint8Array | null> => {
    const raw = await drive.readFile(DOCUMENT_FILE);

    // `null` from the gateway means Drive is sure the file is absent — a first run.
    // An empty string means the file exists and is empty, which is a different thing
    // and never a reason to overwrite it.
    if (raw === null) return null;
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

  return {
    async sync() {
      const remote = await readRemote();

      // Merge before publishing, always. Uploading a state that has not absorbed the
      // current remote is the one move that can still lose another device's work.
      if (remote) await session.merge(remote);

      const payload = await encryptBytesWithDek(requireDek(), session.encode());
      await drive.writeFile(DOCUMENT_FILE, JSON.stringify(payload));
    },
  };
}
