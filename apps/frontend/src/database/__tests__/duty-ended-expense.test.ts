import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/database/index.ts';
import { documentDb, documentSession } from '@/database/document/document.container.ts';
import { addDBDutiesForDateRange } from '../duty.ts';
import { resolveDBDuty } from '../duty.ts';
import { FREQUENCY } from '@/constant.ts';

const seedSubscription = (endsAt?: Date) =>
  documentSession.put('expenses', {
    id: 'expense-1',
    createdAt: new Date(2026, 0, 15),
    description: 'Abonament',
    expense: 65,
    currency: 'PLN',
    severity: null,
    frequency: FREQUENCY.MONTHLY,
    execution: new Date(2026, 0, 15),
    endsAt,
  });

const monthOf = (monthIndex: number) => ({
  startDate: new Date(2026, monthIndex, 1),
  endDate: new Date(2026, monthIndex, 28, 23, 59, 59),
});

/**
 * That ending a series is not the same as deleting it.
 *
 * Deleting the expense was the only way to stop one, and it took every occurrence with it —
 * including the record of which were paid and against which payment. What the person wanted to
 * say was "this stops here", and the answer to that has to leave everything before it standing.
 */
describe('an expense that has been ended', () => {
  beforeEach(async () => {
    await documentDb.documents.clear();
    await db.duties.clear();
    await db.expenses.clear();
    await documentSession.open();
  });

  it('stops being owed in the months after it ended', async () => {
    await seedSubscription(new Date(2026, 1, 20));

    await addDBDutiesForDateRange(monthOf(2), { regenFrom: new Date(2026, 2, 1) });

    expect(await db.duties.toArray()).toEqual([]);
  });

  it('keeps what was already paid, and what it was paid with', async () => {
    await seedSubscription();
    await addDBDutiesForDateRange(monthOf(0), { regenFrom: new Date(2026, 0, 1) });

    const january = (await db.duties.toArray())[0];
    await resolveDBDuty(january.id, true);

    await seedSubscription(new Date(2026, 1, 20));
    await addDBDutiesForDateRange(monthOf(0), { regenFrom: new Date(2026, 0, 1) });

    const paid = (await db.duties.toArray()).filter((duty) => duty.resolved);
    expect(paid.map((duty) => duty.id)).toEqual([january.id]);
  });
});
