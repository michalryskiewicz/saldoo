import Dexie, { type Table } from 'dexie';

export type StoredDocument = { id: string; update: Uint8Array };

/** Whether this device still owes Drive an upload. See `outbox.ts`. */
export type StoredOutbox = { id: string; dirty: boolean };

/**
 * The version this device last saw a Drive file at. See `remote-version.store.ts`.
 *
 * Durable on purpose: held only in memory it would be forgotten on every reload, and the
 * device would re-download a file it already has to learn it had not changed.
 */
export type StoredRemoteVersion = { fileName: string; version: string };

/**
 * The persisted Yjs document, on its **own** Dexie database.
 *
 * Deliberately not a table on the app database, for the same reason the keyfile
 * cache is not: `exportDB` serialises every table it is handed, so a document
 * sitting next to the app's tables would be written into the backup on Drive and
 * imported onto the other device — a copy of the whole database inside the whole
 * database, growing on every sync.
 *
 * The database name is a parameter only so tests can isolate; production uses the
 * default.
 */
export class DocumentDB extends Dexie {
  documents!: Table<StoredDocument, string>;
  outbox!: Table<StoredOutbox, string>;
  remoteVersions!: Table<StoredRemoteVersion, string>;

  constructor(name = 'saldoo-document') {
    super(name);
    this.version(1).stores({ documents: '&id' });
    this.version(2).stores({ documents: '&id', outbox: '&id' });
    this.version(3).stores({ documents: '&id', outbox: '&id', remoteVersions: '&fileName' });
  }
}

export const createDocumentDb = (name?: string) => new DocumentDB(name);
