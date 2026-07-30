import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/database/index.ts';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBTransaction } from '@/database/transactions.ts';
import { createDocument, deleteRecord, putRecord, updateFields } from '../document.ts';
import { createProjector } from '../projector.ts';

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

function transaction(id: string, over: Partial<DBTransaction> = {}): DBTransaction {
  return {
    id,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    sourceBank: 'ING',
    amount: -50,
    currency: 'PLN',
    transactionDate: '2026-01-02',
    description: 'Shop',
    hash: `h-${id}`,
    ...over,
  };
}

describe('projector', () => {
  beforeEach(async () => {
    await Promise.all([
      db.expenses.clear(),
      db.transactions.clear(),
      db.tags.clear(),
      db.duties.clear(),
    ]);
  });

  it('writes a record added to the document into Dexie', async () => {
    const doc = createDocument();
    const projector = createProjector(doc, db);
    projector.start();

    putRecord(doc, 'expenses', expense('e1', 'Rent'));
    await projector.settled();

    const row = await db.expenses.get('e1');
    expect(row?.description).toBe('Rent');
    expect(row?.createdAt).toBeInstanceOf(Date);
  });

  it('applies a single-field change without disturbing the rest of the row', async () => {
    const doc = createDocument();
    const projector = createProjector(doc, db);
    projector.start();

    putRecord(doc, 'expenses', expense('e1', 'Rent', 2500));
    await projector.settled();

    updateFields(doc, 'expenses', 'e1', { expense: 2600 });
    await projector.settled();

    const row = await db.expenses.get('e1');
    expect(row?.expense).toBe(2600);
    expect(row?.description).toBe('Rent');
  });

  it('removes the row when the record leaves the document', async () => {
    const doc = createDocument();
    const projector = createProjector(doc, db);
    projector.start();

    putRecord(doc, 'expenses', expense('e1', 'Rent'));
    await projector.settled();

    deleteRecord(doc, 'expenses', 'e1');
    await projector.settled();

    expect(await db.expenses.get('e1')).toBeUndefined();
  });

  it('projects duties like any other table, keyed by their hash', async () => {
    const doc = createDocument();
    const projector = createProjector(doc, db);
    projector.start();

    putRecord(doc, 'duties', {
      id: 'duty-hash-1',
      hash: 'duty-hash-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      executionDate: new Date('2026-02-01T00:00:00.000Z'),
      resolved: true,
    });
    await projector.settled();

    const duty = await db.duties.get('duty-hash-1');
    expect(duty?.resolved).toBe(true);
    expect(duty?.executionDate).toBeInstanceOf(Date);
  });

  it('never clears a table — an untouched row survives another record changing', async () => {
    // Rebuilding a table wholesale would make useLiveQuery emit [], flashing lists
    // empty and resetting a form mid-typing.
    const doc = createDocument();
    const projector = createProjector(doc, db);
    projector.start();

    putRecord(doc, 'expenses', expense('e1', 'Rent'));
    putRecord(doc, 'expenses', expense('e2', 'Coffee'));
    await projector.settled();

    deleteRecord(doc, 'expenses', 'e1');
    await projector.settled();

    expect((await db.expenses.get('e2'))?.description).toBe('Coffee');
  });

  it('leaves rows of other records alone when one record changes', async () => {
    const doc = createDocument();
    const projector = createProjector(doc, db);
    projector.start();

    putRecord(doc, 'expenses', expense('e1', 'Rent'));
    putRecord(doc, 'expenses', expense('e2', 'Coffee'));
    await projector.settled();

    updateFields(doc, 'expenses', 'e1', { description: 'Rent, flat 3' });
    await projector.settled();

    expect((await db.expenses.get('e2'))?.description).toBe('Coffee');
  });

  it('rehydrates the denormalised expense and tag the document does not carry', async () => {
    const doc = createDocument();
    const projector = createProjector(doc, db);
    projector.start();

    putRecord(doc, 'expenses', expense('e1', 'Rent'));
    putRecord(doc, 'tags', {
      id: 't1',
      name: 'home',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    putRecord(doc, 'transactions', transaction('tr1', { expenseId: 'e1', tagId: 't1' }));
    await projector.settled();

    const row = await db.transactions.get('tr1');
    expect(row?.expense?.description).toBe('Rent');
    expect(row?.tag?.name).toBe('home');
  });

  it('leaves the denormalised copies absent when there is nothing to point at', async () => {
    const doc = createDocument();
    const projector = createProjector(doc, db);
    projector.start();

    putRecord(doc, 'transactions', transaction('tr1', { expenseId: 'gone' }));
    await projector.settled();

    const row = await db.transactions.get('tr1');
    expect(row).toBeDefined();
    expect(row?.expense).toBeUndefined();
  });

  it('projects everything already in the document when it starts', async () => {
    const doc = createDocument();
    putRecord(doc, 'expenses', expense('e1', 'Rent'));
    putRecord(doc, 'expenses', expense('e2', 'Coffee'));

    const projector = createProjector(doc, db);
    projector.start();
    await projector.settled();

    expect(await db.expenses.count()).toBe(2);
  });

  it('stops writing once stopped', async () => {
    const doc = createDocument();
    const projector = createProjector(doc, db);
    projector.start();
    projector.stop();

    putRecord(doc, 'expenses', expense('e1', 'Rent'));
    await projector.settled();

    expect(await db.expenses.get('e1')).toBeUndefined();
  });
});
