import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/database/index.ts';
import type { DBExpense } from '@/database/expenses.ts';
import { createDocumentDb } from '../document-db.ts';
import { createIndexedDbDocumentStore } from '../document-store.ts';
import { createDocumentSession, type DocumentSession } from '../document-session.ts';
import { migrateFromDexie } from '../migrate-from-dexie.ts';

function session(name: string): DocumentSession {
  return createDocumentSession({
    store: createIndexedDbDocumentStore(createDocumentDb(name)),
    database: db,
  });
}

const rent: DBExpense = {
  id: 'e1',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  updatedAt: new Date('2026-02-03T04:05:06.000Z'),
  description: 'Rent',
  expense: 2500,
  currency: 'PLN',
  severity: null,
  tagId: 't1',
};

describe('migrate from Dexie', () => {
  beforeEach(async () => {
    await Promise.all([
      db.expenses.clear(),
      db.profits.clear(),
      db.tags.clear(),
      db.transactions.clear(),
      db.duties.clear(),
    ]);
  });

  it('lifts an existing user’s rows into an empty document', async () => {
    await db.expenses.put(rent);
    await db.tags.put({ id: 't1', name: 'home', createdAt: new Date('2026-01-01T00:00:00.000Z') });

    const s = session(`mig-lift-${Math.random()}`);
    await s.open();
    await migrateFromDexie(s, db);

    expect(s.records('expenses').map((r) => r.id)).toEqual(['e1']);
    expect(s.records('tags').map((r) => r.id)).toEqual(['t1']);
    await s.close();
  });

  it('keeps dates as dates through the migration', async () => {
    await db.expenses.put(rent);

    const s = session(`mig-dates-${Math.random()}`);
    await s.open();
    await migrateFromDexie(s, db);

    const migrated = s.records('expenses')[0] as unknown as DBExpense;
    expect(migrated.createdAt).toBeInstanceOf(Date);
    expect(migrated.createdAt.getTime()).toBe(rent.createdAt.getTime());
    expect(migrated.updatedAt?.getTime()).toBe(rent.updatedAt?.getTime());
    await s.close();
  });

  it('runs once — a second pass does not duplicate anything', async () => {
    await db.expenses.put(rent);
    const name = `mig-once-${Math.random()}`;

    const first = session(name);
    await first.open();
    await migrateFromDexie(first, db);
    await first.close();

    const second = session(name);
    await second.open();
    await migrateFromDexie(second, db);

    expect(second.records('expenses')).toHaveLength(1);
    await second.close();
  });

  it('does not resurrect a record the user deleted after migrating', async () => {
    // The marker matters here: without it, a second migration would lift the row
    // back out of Dexie... except the projector already removed it, so the real
    // hazard is re-lifting a stale Dexie row on a device that has since synced a
    // deletion. The marker is what makes the migration a one-time event.
    await db.expenses.put(rent);
    const name = `mig-deleted-${Math.random()}`;

    const s = session(name);
    await s.open();
    await migrateFromDexie(s, db);
    await s.remove('expenses', 'e1');
    await s.close();

    const reopened = session(name);
    await reopened.open();
    await migrateFromDexie(reopened, db);

    expect(reopened.records('expenses')).toHaveLength(0);
    await reopened.close();
  });

  it('is a no-op on a fresh install with nothing to lift', async () => {
    const s = session(`mig-fresh-${Math.random()}`);
    await s.open();
    await migrateFromDexie(s, db);

    expect(s.records('expenses')).toHaveLength(0);
    await s.close();
  });

  it('re-keys an existing duty from its uuid to its hash', async () => {
    // Duties used to carry a random uuid as the primary key and a deterministic hash
    // beside it, which is exactly why they could not sync. Identity is the hash now.
    await db.duties.put({
      id: 'a-random-uuid',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      executionDate: new Date('2026-02-01T00:00:00.000Z'),
      hash: 'duty-hash-1',
      resolved: true,
    });

    const s = session(`mig-duties-${Math.random()}`);
    await s.open();
    await migrateFromDexie(s, db);

    const migrated = s.records('duties');
    expect(migrated.map((d) => d.id)).toEqual(['duty-hash-1']);
    expect(migrated[0].resolved).toBe(true);
    await s.close();
  });
});
