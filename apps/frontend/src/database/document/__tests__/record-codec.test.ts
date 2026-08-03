import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { SEVERITY } from '@/constant.ts';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBTransaction } from '@/database/transactions.ts';
import { decodeRecord, encodeRecord } from '../record-codec.ts';

/**
 * Sends a record through a real Yjs replication hop: write it into one document,
 * serialise, apply to a second document, read it back out.
 *
 * Reading from the *same* document is a false oracle. Yjs hands back the JS value
 * it is holding, so a `Date` written into a `Y.Map` reads back as that same `Date`
 * and every assertion passes — while the value that reaches another device is `{}`.
 * Only an encode/apply round trip tells the truth.
 */
function overTheWire<T>(record: T, encode: (r: T) => unknown): unknown {
  const local = new Y.Doc();
  local.getMap('records').set('r1', encode(record));

  const remote = new Y.Doc();
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(local));

  return remote.getMap('records').get('r1');
}

const expense: DBExpense = {
  id: 'e1',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  updatedAt: new Date('2026-02-03T04:05:06.000Z'),
  execution: new Date('2026-03-04T05:06:07.000Z'),
  endsAt: new Date('2026-04-05T06:07:08.000Z'),
  description: 'Rent',
  expense: 2500,
  currency: 'PLN',
  severity: SEVERITY.HIGH,
  tagId: 't1',
};

describe('record codec', () => {
  it('keeps every date across a replication hop', () => {
    const wire = overTheWire(expense, (r) => encodeRecord('expenses', r));
    const back = decodeRecord('expenses', wire as Record<string, unknown>) as DBExpense;

    expect(back.createdAt).toBeInstanceOf(Date);
    expect(back.createdAt.getTime()).toBe(expense.createdAt.getTime());
    expect(back.updatedAt?.getTime()).toBe(expense.updatedAt?.getTime());
    expect(back.execution?.getTime()).toBe(expense.execution?.getTime());
    expect(back.endsAt?.getTime()).toBe(expense.endsAt?.getTime());
  });

  /**
   * A nested object, and the whole reason this file exists is that Yjs accepts things it cannot
   * carry. `Date` is the one that bit: written into a `Y.Map` it reads back correctly on the
   * device that wrote it and arrives as `{}` everywhere else. Anything new that crosses the wire
   * gets asserted here, through a real replication hop, before it is trusted.
   */
  it('keeps the share of an income, nested object and all, across a replication hop', () => {
    const tax: DBExpense = {
      ...expense,
      expense: 0,
      percentageOfIncome: {
        percent: 12,
        profitIds: ['client-a', 'client-b'],
        basePeriod: 'previousMonth',
      },
    };

    const wire = overTheWire(tax, (r) => encodeRecord('expenses', r));
    const back = decodeRecord('expenses', wire as Record<string, unknown>) as DBExpense;

    expect(back.percentageOfIncome).toEqual({
      percent: 12,
      profitIds: ['client-a', 'client-b'],
      basePeriod: 'previousMonth',
    });
  });

  it('keeps the non-date fields byte for byte', () => {
    const wire = overTheWire(expense, (r) => encodeRecord('expenses', r));
    const back = decodeRecord('expenses', wire as Record<string, unknown>) as DBExpense;

    expect(back.id).toBe('e1');
    expect(back.description).toBe('Rent');
    expect(back.expense).toBe(2500);
    expect(back.currency).toBe('PLN');
    expect(back.severity).toBe(SEVERITY.HIGH);
    expect(back.tagId).toBe('t1');
  });

  it('leaves absent optional dates absent rather than inventing an epoch', () => {
    const minimal: DBExpense = {
      id: 'e2',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      description: 'Coffee',
      expense: 12,
      currency: 'PLN',
      severity: null,
    };

    const wire = overTheWire(minimal, (r) => encodeRecord('expenses', r));
    const back = decodeRecord('expenses', wire as Record<string, unknown>) as DBExpense;

    expect(back.updatedAt).toBeUndefined();
    expect(back.execution).toBeUndefined();
    expect(back.severity).toBeNull();
  });

  it('carries an imported CSV row through unchanged', () => {
    const transaction: DBTransaction = {
      id: 'tr1',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      sourceBank: 'ING',
      amount: -99.5,
      currency: 'PLN',
      transactionDate: '2026-01-02',
      description: 'Shop',
      hash: 'h1',
      rawData: ['2026-01-02', 'Shop', '-99,50', 'PLN'],
    };

    const wire = overTheWire(transaction, (r) => encodeRecord('transactions', r));
    const back = decodeRecord('transactions', wire as Record<string, unknown>) as DBTransaction;

    expect(back.rawData).toEqual(['2026-01-02', 'Shop', '-99,50', 'PLN']);
    expect(back.createdAt).toBeInstanceOf(Date);
  });

  it('drops the denormalised copies and keeps only the reference', () => {
    const transaction: DBTransaction = {
      id: 'tr2',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      sourceBank: 'ING',
      amount: -10,
      currency: 'PLN',
      transactionDate: '2026-01-02',
      description: 'Shop',
      hash: 'h2',
      expenseId: 'e1',
      expense,
      tagId: 't1',
      tag: { id: 't1', name: 'food', createdAt: new Date('2026-01-01T00:00:00.000Z') },
    };

    const encoded = encodeRecord('transactions', transaction) as Record<string, unknown>;

    expect(encoded).not.toHaveProperty('expense');
    expect(encoded).not.toHaveProperty('tag');
    expect(encoded.expenseId).toBe('e1');
    expect(encoded.tagId).toBe('t1');
  });

  it('proves why the codec exists: a raw Date does not survive the same hop', () => {
    const wire = overTheWire(expense, (r) => ({ ...r })) as Record<string, unknown>;

    expect(wire.createdAt).not.toBeInstanceOf(Date);
    expect(wire.createdAt).toEqual({});
  });
});

describe('a profit that ends', () => {
  it('keeps its ending across a replication hop', () => {
    // Every table declares its own date fields, so a new one is carried on one table and lost
    // on the next — silently, and only on the far device.
    const profit = {
      id: 'p1',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      execution: new Date('2026-03-04T05:06:07.000Z'),
      endsAt: new Date('2026-09-10T11:12:13.000Z'),
      description: 'Umowa',
      profit: 4000,
      currency: 'PLN' as const,
    };

    const wire = overTheWire(profit, (r) => encodeRecord('profits', r));
    const back = decodeRecord('profits', wire as Record<string, unknown>) as typeof profit;

    expect(back.endsAt).toBeInstanceOf(Date);
    expect(back.endsAt.getTime()).toBe(profit.endsAt.getTime());
  });
});
