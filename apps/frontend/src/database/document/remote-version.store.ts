import { createDocumentDb, type DocumentDB } from './document-db.ts';

/**
 * Remembers the version this device last saw a Drive file at.
 *
 * Two jobs, and the second is why it has to be durable:
 *
 * 1. It is the precondition a write is made under — "I merged against version 7, refuse my
 *    upload if Drive has moved past it".
 * 2. It lets a sync notice the remote has not changed **without downloading it**. Kept
 *    only in memory that saving would evaporate on every reload, which is exactly when a
 *    device is most likely to sync.
 *
 * A missing entry always means "download". There is no version that means "assume
 * unchanged".
 */
export interface RemoteVersionStore {
  read(fileName: string): Promise<string | null>;
  write(fileName: string, version: string): Promise<void>;
  /** Used when the file turned out not to be there, so the next sync starts from nothing. */
  forget(fileName: string): Promise<void>;
}

export function createIndexedDbRemoteVersionStore(
  database: DocumentDB = createDocumentDb()
): RemoteVersionStore {
  return {
    async read(fileName) {
      return (await database.remoteVersions.get(fileName))?.version ?? null;
    },

    async write(fileName, version) {
      await database.remoteVersions.put({ fileName, version });
    },

    async forget(fileName) {
      await database.remoteVersions.delete(fileName);
    },
  };
}
