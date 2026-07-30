import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/database/index.ts';
import type { DBExpense } from '@/database/expenses.ts';
import { createDocumentDb } from '../document-db.ts';
import { createIndexedDbDocumentStore } from '../document-store.ts';
import { createDocumentSession } from '../document-session.ts';

function expense(id: string, description: string, amount = 100): DBExpense {
  return {
    id,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    description,
    expense: amount,
    currency: 'PLN',
    severity: null,
  };
}

/** A session on its own document database, so tests cannot leak into each other. */
function session(name: string) {
  return createDocumentSession({
    store: createIndexedDbDocumentStore(createDocumentDb(name)),
    database: db,
  });
}

describe('document session', () => {
  beforeEach(async () => {
    await Promise.all([db.expenses.clear(), db.tags.clear(), db.transactions.clear()]);
  });

  it('starts empty on a device that has never used the app', async () => {
    const s = session(`sess-empty-${Math.random()}`);
    await s.open();

    expect(s.records('expenses')).toHaveLength(0);
    await s.close();
  });

  it('projects a written record into Dexie without the caller asking', async () => {
    const s = session(`sess-write-${Math.random()}`);
    await s.open();

    await s.put('expenses', expense('e1', 'Rent'));

    expect((await db.expenses.get('e1'))?.description).toBe('Rent');
    await s.close();
  });

  it('still has the record after the app is closed and reopened', async () => {
    const name = `sess-reload-${Math.random()}`;

    const first = session(name);
    await first.open();
    await first.put('expenses', expense('e1', 'Rent'));
    await first.close();

    // A different session instance on the same database is what a reload looks like.
    const second = session(name);
    await second.open();

    expect(second.records('expenses').map((r) => r.id)).toEqual(['e1']);
    expect((await db.expenses.get('e1'))?.description).toBe('Rent');
    await second.close();
  });

  it('persists a field update, not just the initial write', async () => {
    const name = `sess-update-${Math.random()}`;

    const first = session(name);
    await first.open();
    await first.put('expenses', expense('e1', 'Rent', 2500));
    await first.update('expenses', 'e1', { expense: 2600 });
    await first.close();

    const second = session(name);
    await second.open();

    expect((second.records('expenses')[0] as DBExpense).expense).toBe(2600);
    await second.close();
  });

  it('persists a deletion, so it does not come back after a reload', async () => {
    const name = `sess-delete-${Math.random()}`;

    const first = session(name);
    await first.open();
    await first.put('expenses', expense('e1', 'Rent'));
    await first.remove('expenses', 'e1');
    await first.close();

    const second = session(name);
    await second.open();

    expect(second.records('expenses')).toHaveLength(0);
    expect(await db.expenses.get('e1')).toBeUndefined();
    await second.close();
  });

  it('reports the local commit before any network work could have happened', async () => {
    // The whole point of the document being local truth: a write returns once it is
    // in IndexedDB. Nothing here can await Drive, because nothing here knows about it.
    const s = session(`sess-offline-${Math.random()}`);
    await s.open();

    await expect(s.put('expenses', expense('e1', 'Rent'))).resolves.toBeUndefined();

    expect(s.records('expenses')).toHaveLength(1);
    await s.close();
  });

  it('exchanges state with another device through encode and merge', async () => {
    // The seam the Drive transport will use: each side encodes its whole state, the
    // other merges it. No Drive here, just the two halves of the round trip.
    const laptop = session(`sess-laptop-${Math.random()}`);
    const phone = session(`sess-phone-${Math.random()}`);
    await laptop.open();
    await phone.open();

    await laptop.put('expenses', expense('e1', 'Rent'));
    await phone.put('expenses', expense('e2', 'Coffee'));

    const fromLaptop = laptop.encode();
    const fromPhone = phone.encode();
    await phone.merge(fromLaptop);
    await laptop.merge(fromPhone);

    expect(laptop.records('expenses').map((r) => r.id).sort()).toEqual(['e1', 'e2']);
    expect(phone.records('expenses').map((r) => r.id).sort()).toEqual(['e1', 'e2']);

    await laptop.close();
    await phone.close();
  });

  it('keeps a merged record after a reload, not just in memory', async () => {
    const name = `sess-merged-${Math.random()}`;
    const other = session(`sess-other-${Math.random()}`);
    await other.open();
    await other.put('expenses', expense('e9', 'From the other device'));

    const local = session(name);
    await local.open();
    await local.merge(other.encode());
    await local.close();
    await other.close();

    const reopened = session(name);
    await reopened.open();

    expect(reopened.records('expenses').map((r) => r.id)).toEqual(['e9']);
    await reopened.close();
  });

  it('stops projecting once closed', async () => {
    const name = `sess-closed-${Math.random()}`;
    const s = session(name);
    await s.open();
    await s.close();

    await s.put('expenses', expense('e1', 'Rent'));

    expect(await db.expenses.get('e1')).toBeUndefined();
  });
});
