import * as Y from 'yjs';
import { createDocumentDb, type DocumentDB } from './document-db.ts';

/**
 * Keeps the Yjs document on this device across reloads.
 *
 * Without this the document would only live in the tab: a reload would lose every
 * change that had not yet reached Drive, which is the failure the merge work exists
 * to prevent.
 */
export interface DocumentStore {
  /** The stored state, or `null` on a device that has never saved one. */
  load(): Promise<Uint8Array | null>;
  save(doc: Y.Doc): Promise<void>;
  clear(): Promise<void>;
}

const SINGLETON_ID = 'document';

export function createIndexedDbDocumentStore(
  database: DocumentDB = createDocumentDb(),
): DocumentStore {
  return {
    async load() {
      const stored = await database.documents.get(SINGLETON_ID);
      return stored?.update ?? null;
    },

    async save(doc) {
      // The whole state rather than a diff: it is what the Drive transport uploads
      // anyway, and one row that is always complete cannot half-apply the way an
      // append-only list of updates can if a write is interrupted.
      await database.documents.put({
        id: SINGLETON_ID,
        update: Y.encodeStateAsUpdate(doc),
      });
    },

    async clear() {
      await database.documents.delete(SINGLETON_ID);
    },
  };
}
