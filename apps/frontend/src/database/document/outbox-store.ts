import { createDocumentDb, type DocumentDB } from './document-db.ts';

/**
 * Remembers across reloads that this device still owes Drive an upload.
 *
 * Deliberately a single flag rather than a list of operations: the transport uploads
 * the whole document state, so "what to send" is never in question — only "is there
 * anything to send".
 */
export interface OutboxStore {
  read(): Promise<boolean>;
  write(dirty: boolean): Promise<void>;
}

const SINGLETON_ID = 'outbox';

export function createIndexedDbOutboxStore(
  database: DocumentDB = createDocumentDb(),
): OutboxStore {
  return {
    async read() {
      const stored = await database.outbox.get(SINGLETON_ID);
      return stored?.dirty ?? false;
    },

    async write(dirty) {
      await database.outbox.put({ id: SINGLETON_ID, dirty });
    },
  };
}
