import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { DBExpense } from '@/database/expenses.ts';
import {
  createDocument,
  deleteRecord,
  putRecord,
  readAllRecords,
  readRecord,
  updateFields,
} from '../document.ts';

/**
 * Two devices exchanging full state, the way the Drive transport will: each encodes
 * its whole document, the other applies it. Bidirectional, one pass.
 */
function sync(a: Y.Doc, b: Y.Doc): void {
  const fromA = Y.encodeStateAsUpdate(a);
  const fromB = Y.encodeStateAsUpdate(b);
  Y.applyUpdate(b, fromA);
  Y.applyUpdate(a, fromB);
}

function expense(id: string, description: string, amount: number): DBExpense {
  return {
    id,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    description,
    expense: amount,
    currency: 'PLN',
    severity: null,
  };
}

describe('document', () => {
  it('keeps both records when two devices add different ones offline', () => {
    const laptop = createDocument();
    const phone = createDocument();

    putRecord(laptop, 'expenses', expense('e1', 'Rent', 2500));
    putRecord(phone, 'expenses', expense('e2', 'Coffee', 12));

    sync(laptop, phone);

    for (const [name, doc] of [
      ['laptop', laptop],
      ['phone', phone],
    ] as const) {
      const ids = readAllRecords(doc, 'expenses').map((r) => r.id);
      expect(ids.sort(), name).toEqual(['e1', 'e2']);
    }
  });

  it('needs only one pass — neither device has to sync twice to see the other', () => {
    const laptop = createDocument();
    const phone = createDocument();

    putRecord(laptop, 'expenses', expense('e1', 'Rent', 2500));
    putRecord(phone, 'expenses', expense('e2', 'Coffee', 12));

    sync(laptop, phone);

    expect(readRecord(laptop, 'expenses', 'e2')).not.toBeNull();
    expect(readRecord(phone, 'expenses', 'e1')).not.toBeNull();
  });

  it('keeps both edits when two devices change different fields of one record', () => {
    const laptop = createDocument();
    const phone = createDocument();
    putRecord(laptop, 'expenses', expense('e1', 'Rent', 2500));
    sync(laptop, phone);

    updateFields(laptop, 'expenses', 'e1', { description: 'Rent, flat 3' });
    updateFields(phone, 'expenses', 'e1', { expense: 2600 });

    sync(laptop, phone);

    const fromLaptop = readRecord(laptop, 'expenses', 'e1') as DBExpense;
    const fromPhone = readRecord(phone, 'expenses', 'e1') as DBExpense;

    expect(fromLaptop.description).toBe('Rent, flat 3');
    expect(fromLaptop.expense).toBe(2600);
    expect(fromPhone).toEqual(fromLaptop);
  });

  it('converges on the same result whichever way round the devices sync', () => {
    const build = () => {
      const a = createDocument();
      const b = createDocument();
      putRecord(a, 'expenses', expense('e1', 'A', 1));
      putRecord(b, 'expenses', expense('e1', 'B', 2));
      return [a, b] as const;
    };

    const [a1, b1] = build();
    Y.applyUpdate(b1, Y.encodeStateAsUpdate(a1));
    Y.applyUpdate(a1, Y.encodeStateAsUpdate(b1));

    const [a2, b2] = build();
    Y.applyUpdate(a2, Y.encodeStateAsUpdate(b2));
    Y.applyUpdate(b2, Y.encodeStateAsUpdate(a2));

    expect(readRecord(a1, 'expenses', 'e1')).toEqual(readRecord(b1, 'expenses', 'e1'));
    expect(readRecord(a2, 'expenses', 'e1')).toEqual(readRecord(b2, 'expenses', 'e1'));
  });

  it('propagates a deletion instead of letting the other device resurrect it', () => {
    const laptop = createDocument();
    const phone = createDocument();
    putRecord(laptop, 'expenses', expense('e1', 'Rent', 2500));
    sync(laptop, phone);

    deleteRecord(laptop, 'expenses', 'e1');
    sync(laptop, phone);

    expect(readRecord(phone, 'expenses', 'e1')).toBeNull();
    expect(readAllRecords(phone, 'expenses')).toHaveLength(0);
  });

  it('keeps a deletion deleted on a third device that was offline throughout', () => {
    const laptop = createDocument();
    const phone = createDocument();
    const tablet = createDocument();

    putRecord(laptop, 'expenses', expense('e1', 'Rent', 2500));
    sync(laptop, phone);
    deleteRecord(laptop, 'expenses', 'e1');
    sync(laptop, phone);

    // The tablet has seen neither the creation nor the deletion until now.
    sync(laptop, tablet);

    expect(readRecord(tablet, 'expenses', 'e1')).toBeNull();
  });

  it('lets a delete win over a concurrent edit, as documented', () => {
    const laptop = createDocument();
    const phone = createDocument();
    putRecord(laptop, 'expenses', expense('e1', 'Rent', 2500));
    sync(laptop, phone);

    deleteRecord(laptop, 'expenses', 'e1');
    updateFields(phone, 'expenses', 'e1', { expense: 9999 });

    sync(laptop, phone);

    expect(readRecord(laptop, 'expenses', 'e1')).toBeNull();
    expect(readRecord(phone, 'expenses', 'e1')).toBeNull();
  });

  it('carries a duty marked paid on one device to the other', () => {
    // The reason duty identity became the hash. Before that a duty was keyed by a
    // random uuid, so the same logical duty existed as two different rows on two
    // devices and the user's resolved mark could not travel.
    const laptop = createDocument();
    const phone = createDocument();

    const duty = {
      id: 'duty-hash-1',
      hash: 'duty-hash-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      executionDate: new Date('2026-02-01T00:00:00.000Z'),
    };
    putRecord(laptop, 'duties', duty);
    sync(laptop, phone);

    updateFields(laptop, 'duties', 'duty-hash-1', { resolved: true });
    sync(laptop, phone);

    expect(readRecord(phone, 'duties', 'duty-hash-1')?.resolved).toBe(true);
  });

  it('converges when both devices generate the same duty independently', () => {
    // Deterministic identity means two devices generating the same window produce
    // one row, not two racing on the unique hash index.
    const laptop = createDocument();
    const phone = createDocument();

    const duty = {
      id: 'duty-hash-1',
      hash: 'duty-hash-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      executionDate: new Date('2026-02-01T00:00:00.000Z'),
    };
    putRecord(laptop, 'duties', duty);
    putRecord(phone, 'duties', duty);

    sync(laptop, phone);

    expect(readAllRecords(laptop, 'duties')).toHaveLength(1);
    expect(readAllRecords(phone, 'duties')).toHaveLength(1);
  });

  /**
   * Clearing a field, which is not the same as leaving it alone.
   *
   * A partial update writes the keys it was given and touches nothing else, which is the whole
   * point of it — so "this field no longer applies" has to be sayable. It came up switching a cost
   * from a share of an income back to a plain amount: without this the share stays on the record,
   * every total goes on computing 12% of an invoice, and the form shows an amount that nothing
   * reads.
   *
   * A key explicitly set to `undefined` means remove it; a key simply absent still means leave it
   * alone. Both directions are asserted, because a delete pass that could not tell them apart
   * would wipe every field a partial update did not mention.
   */
  it('removes a field set to undefined, and still leaves absent fields alone', () => {
    const laptop = createDocument();
    const phone = createDocument();

    putRecord(laptop, 'expenses', {
      ...expense('e1', 'Tax', 0),
      percentageOfIncome: { percent: 12, profitIds: ['client-a'], basePeriod: 'previousMonth' },
    });
    sync(laptop, phone);

    updateFields(laptop, 'expenses', 'e1', { expense: 2500, percentageOfIncome: undefined });
    sync(laptop, phone);

    const received = readRecord(phone, 'expenses', 'e1') as DBExpense;
    expect(received.percentageOfIncome).toBeUndefined();
    expect(received.expense).toBe(2500);
    expect(received.description).toBe('Tax');
  });

  it('rebuilds dates as real Dates on the receiving device', () => {
    const laptop = createDocument();
    const phone = createDocument();

    putRecord(laptop, 'expenses', {
      ...expense('e1', 'Rent', 2500),
      execution: new Date('2026-05-06T07:08:09.000Z'),
    });
    sync(laptop, phone);

    const received = readRecord(phone, 'expenses', 'e1') as DBExpense;
    expect(received.createdAt).toBeInstanceOf(Date);
    expect(received.execution?.toISOString()).toBe('2026-05-06T07:08:09.000Z');
  });
});
