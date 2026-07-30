import { db } from '@/database/index.ts';
import { createDocumentDb } from './document-db.ts';
import { createDocumentSession } from './document-session.ts';
import { createIndexedDbDocumentStore } from './document-store.ts';
import { dropStaleDutyKeys } from './drop-stale-duty-keys.ts';
import { migrateFromDexie } from './migrate-from-dexie.ts';

/**
 * The one document session the app writes through.
 *
 * A singleton because the document *is* the local truth: two sessions would mean two
 * truths racing to project into the same Dexie tables.
 */
/** One database instance, shared by the document store and the outbox. */
export const documentDb = createDocumentDb();

export const documentSession = createDocumentSession({
  store: createIndexedDbDocumentStore(documentDb),
  database: db,
});

let opening: Promise<void> | null = null;

/**
 * Restores the document and lifts an existing user's rows into it, once per app run.
 *
 * Idempotent and safe to await from more than one place: React can mount an effect
 * twice under StrictMode, and every caller has to wait for the same open rather than
 * starting a second one.
 */
export function openDocument(): Promise<void> {
  opening ??= (async () => {
    // Before the migration, and on every open rather than once: see the note in
    // `dropStaleDutyKeys` for why this cannot hang off the migration marker.
    await dropStaleDutyKeys(db);

    await documentSession.open();
    await migrateFromDexie(documentSession, db);
  })();

  return opening;
}
