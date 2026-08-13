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

  /**
   * The three records goals brought with them, each over a real replication hop.
   *
   * Not optional and not ceremony: a `Date` written into a `Y.Map` reads back correctly on the
   * device that wrote it and arrives as `{}` everywhere else, so anything new that crosses the
   * wire is asserted here before it is trusted. A goal alone carries four dates.
   */
  it('keeps a goal, its contributions and a closed window across a replication hop', () => {
    const goal = {
      id: 'g1',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      updatedAt: new Date('2026-02-03T04:05:06.000Z'),
      description: 'IKE',
      currency: 'PLN',
      strategyPart: 'LONG_TERM_SAVINGS',
      keepsItsMoney: true,
      target: 30000,
      deadline: new Date('2026-12-31T00:00:00.000Z'),
      year: 2026,
      seriesId: 's1',
      closedAt: new Date('2026-12-31T23:00:00.000Z'),
    };

    const backAsGoal = decodeRecord(
      'goals',
      overTheWire(goal, (r) => encodeRecord('goals', r)) as Record<string, unknown>
    ) as typeof goal;

    expect(backAsGoal.createdAt).toBeInstanceOf(Date);
    expect(backAsGoal.deadline?.getTime()).toBe(goal.deadline.getTime());
    expect(backAsGoal.closedAt?.getTime()).toBe(goal.closedAt.getTime());
    expect(backAsGoal.keepsItsMoney).toBe(true);
    expect(backAsGoal.seriesId).toBe('s1');

    const contribution = {
      id: 'c1',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      goalId: 'g1',
      amount: 2500,
      contributedAt: new Date('2026-03-10T00:00:00.000Z'),
    };

    const backAsContribution = decodeRecord(
      'contributions',
      overTheWire(contribution, (r) => encodeRecord('contributions', r)) as Record<string, unknown>
    ) as typeof contribution;

    expect(backAsContribution.contributedAt).toBeInstanceOf(Date);
    expect(backAsContribution.contributedAt.getTime()).toBe(contribution.contributedAt.getTime());
    expect(backAsContribution.amount).toBe(2500);

    const closed = {
      id: 'w1',
      createdAt: new Date('2027-01-01T00:00:00.000Z'),
      goalId: 'g1',
      seriesId: 's1',
      year: 2026,
      target: 30000,
      contributed: 26000,
      openedOn: new Date('2026-01-01T00:00:00.000Z'),
      closedOn: new Date('2026-12-31T00:00:00.000Z'),
    };

    const backAsClosed = decodeRecord(
      'closedWindows',
      overTheWire(closed, (r) => encodeRecord('closedWindows', r)) as Record<string, unknown>
    ) as typeof closed;

    expect(backAsClosed.openedOn).toBeInstanceOf(Date);
    expect(backAsClosed.closedOn.getTime()).toBe(closed.closedOn.getTime());
    expect(backAsClosed.contributed).toBe(26000);
  });

  it('keeps a position across a replication hop', () => {
    const position = {
      id: 'p1',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      description: 'IKE',
      kind: 'asset',
      value: 31000,
      currency: 'PLN',
      valuedOn: new Date('2026-07-01T00:00:00.000Z'),
      boughtOn: new Date('2019-03-15T00:00:00.000Z'),
    };

    const back = decodeRecord(
      'positions',
      overTheWire(position, (r) => encodeRecord('positions', r)) as Record<string, unknown>
    ) as typeof position;

    expect(back.valuedOn).toBeInstanceOf(Date);
    expect(back.valuedOn.getTime()).toBe(position.valuedOn.getTime());
    // The day it was bought is a second date on the same row, and a date the codec has not been told
    // about crosses as `{}` while reading back perfectly on the device that wrote it.
    expect(back.boughtOn).toBeInstanceOf(Date);
    expect(back.boughtOn.getTime()).toBe(position.boughtOn.getTime());
    expect(back.value).toBe(31000);
    expect(back.kind).toBe('asset');
  });

  /**
   * The reason a valuation is its own record rather than a list on the position: the codec knows
   * about date fields at the top level of a row and nowhere else, so dates nested inside an array
   * would cross the wire as `{}` — and would read back correctly on the device that wrote them,
   * which is what makes that failure so quiet.
   */
  it('keeps a valuation across a replication hop', () => {
    const valuation = {
      id: 'v1',
      createdAt: new Date('2026-08-10T09:00:00.000Z'),
      positionId: 'p1',
      value: 31000,
      currency: 'PLN',
      valuedOn: new Date('2026-07-01T00:00:00.000Z'),
    };

    const back = decodeRecord(
      'valuations',
      overTheWire(valuation, (r) => encodeRecord('valuations', r)) as Record<string, unknown>
    ) as typeof valuation;

    expect(back.valuedOn).toBeInstanceOf(Date);
    expect(back.valuedOn.getTime()).toBe(valuation.valuedOn.getTime());
    expect(back.createdAt).toBeInstanceOf(Date);
    expect(back.value).toBe(31000);
    expect(back.positionId).toBe('p1');
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
