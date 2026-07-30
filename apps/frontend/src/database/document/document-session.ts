import * as Y from 'yjs';
import type { AppDB } from '@/database/index.ts';
import { createDocument, deleteRecord, putRecord, readAllRecords, updateFields } from './document.ts';
import type { DocumentStore } from './document-store.ts';
import { createProjector, type Projector } from './projector.ts';
import type { DocumentTable } from './record-codec.ts';

/**
 * The document as the app uses it: one object that owns the `Y.Doc`, restores it on
 * open, keeps Dexie projected from it, and saves it after every change.
 *
 * ## What a write means
 *
 * A write returns once the change is in the document **and** in IndexedDB. It never
 * awaits the network — nothing in here knows Drive exists. That is what lets the
 * mutators stop reporting "could not add the expense" to a user who is offline: the
 * record really is saved, and getting it to Drive is a separate concern
 * (the outbox, `SALDOO-A6.3`).
 */
export interface DocumentSession {
  open(): Promise<void>;
  close(): Promise<void>;

  put(table: DocumentTable, record: object): Promise<void>;
  update(table: DocumentTable, id: string, fields: object): Promise<void>;
  remove(table: DocumentTable, id: string): Promise<void>;

  /** Read straight from the document. Views read Dexie; this is for callers that need truth. */
  records(table: DocumentTable): (Record<string, unknown> & { id: string })[];

  /** The state to hand to the Drive transport. */
  encode(): Uint8Array;
  /** Merge a remote state in. Returns once the result is persisted and projected. */
  merge(update: Uint8Array): Promise<void>;
}

export function createDocumentSession({
  store,
  database,
}: {
  store: DocumentStore;
  database: AppDB;
}): DocumentSession {
  let doc = createDocument();
  let projector: Projector | null = null;

  const persist = async () => {
    await store.save(doc);
    await projector?.settled();
  };

  return {
    async open() {
      doc = createDocument();

      // Restore before the projector starts, so its initial pass sees the whole
      // document and the app renders complete data rather than filling in.
      const restored = await store.load();
      if (restored) Y.applyUpdate(doc, restored);

      projector = createProjector(doc, database);
      projector.start();
      await projector.settled();
    },

    async close() {
      projector?.stop();
      projector = null;
    },

    async put(table, record) {
      putRecord(doc, table, record);
      await persist();
    },

    async update(table, id, fields) {
      updateFields(doc, table, id, fields);
      await persist();
    },

    async remove(table, id) {
      deleteRecord(doc, table, id);
      await persist();
    },

    records(table) {
      return readAllRecords(doc, table);
    },

    encode() {
      return Y.encodeStateAsUpdate(doc);
    },

    async merge(update) {
      Y.applyUpdate(doc, update);
      await persist();
    },
  };
}
