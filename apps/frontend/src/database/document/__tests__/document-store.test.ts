import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { db } from '@/database/index.ts';
import type { DBExpense } from '@/database/expenses.ts';
import { createDocument, putRecord, readAllRecords, readRecord } from '../document.ts';
import { createDocumentDb } from '../document-db.ts';
import { createIndexedDbDocumentStore } from '../document-store.ts';

function expense(id: string, description: string): DBExpense {
  return {
    id,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    description,
    expense: 100,
    currency: 'PLN',
    severity: null,
  };
}

/** A fresh store on its own database, so tests cannot leak into each other. */
function freshStore(name: string) {
  return createIndexedDbDocumentStore(createDocumentDb(name));
}

describe('document store', () => {
  it('reports no document on a device that has never saved one', async () => {
    const store = freshStore(`doc-empty-${Math.random()}`);
    expect(await store.load()).toBeNull();
  });

  it('brings the records back after a reload', async () => {
    const name = `doc-reload-${Math.random()}`;
    const doc = createDocument();
    putRecord(doc, 'expenses', expense('e1', 'Rent'));
    putRecord(doc, 'expenses', expense('e2', 'Coffee'));
    await freshStore(name).save(doc);

    // A new store instance on the same database is what a page reload looks like.
    const restored = createDocument();
    const update = await freshStore(name).load();
    expect(update).not.toBeNull();
    Y.applyUpdate(restored,update as Uint8Array);

    expect(readAllRecords(restored, 'expenses').map((r) => r.id).sort()).toEqual(['e1', 'e2']);
    expect((readRecord(restored, 'expenses', 'e1') as DBExpense).description).toBe('Rent');
  });

  it('rebuilds dates as real Dates after a reload', async () => {
    const name = `doc-dates-${Math.random()}`;
    const doc = createDocument();
    putRecord(doc, 'expenses', expense('e1', 'Rent'));
    await freshStore(name).save(doc);

    const restored = createDocument();
    Y.applyUpdate(restored,(await freshStore(name).load()) as Uint8Array);

    expect((readRecord(restored, 'expenses', 'e1') as DBExpense).createdAt).toBeInstanceOf(Date);
  });

  it('keeps the newest state when saved repeatedly', async () => {
    const name = `doc-latest-${Math.random()}`;
    const store = freshStore(name);
    const doc = createDocument();

    putRecord(doc, 'expenses', expense('e1', 'Rent'));
    await store.save(doc);
    putRecord(doc, 'expenses', expense('e2', 'Coffee'));
    await store.save(doc);

    const restored = createDocument();
    Y.applyUpdate(restored,(await freshStore(name).load()) as Uint8Array);

    expect(readAllRecords(restored, 'expenses')).toHaveLength(2);
  });

  it('stays out of the app database, so it is never uploaded inside the backup', async () => {
    const documentDb = createDocumentDb('doc-isolation');
    const doc = createDocument();
    putRecord(doc, 'expenses', expense('e1', 'Rent'));
    await createIndexedDbDocumentStore(documentDb).save(doc);

    // The Drive payload is built with exportDB, which serialises every table of the
    // database it is handed. So the invariant is about the app database's table
    // list: a document table there would be uploaded inside the backup and
    // imported onto the other device — the same trap that put the keyfile cache in
    // its own database.
    expect(db.tables.map((t) => t.name)).toEqual(
      expect.not.arrayContaining(['document', 'documents']),
    );

    // And it really is a separate database, not just a differently named table.
    expect(documentDb.name).not.toBe(db.name);
    expect(await documentDb.documents.count()).toBe(1);
  });
});
