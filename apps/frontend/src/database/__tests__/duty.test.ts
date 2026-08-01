import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/database/index.ts';
import { documentDb, documentSession } from '@/database/document/document.container.ts';
import { addDBDutiesForDateRange } from '../duty.ts';
import { FREQUENCY } from '@/constant.ts';

const JULY = {
  startDate: new Date(2026, 6, 1),
  endDate: new Date(2026, 6, 31, 23, 59, 59),
};

/**
 * Seeded through the document rather than straight into Dexie: the projector owns those
 * tables and deletes rows the document does not have, so a row written past it would be
 * swept away and the test would pass from an empty table.
 */
const seedExpenseDueOn = (execution: Date) =>
  documentSession.put('expenses', {
    id: 'expense-1',
    createdAt: new Date(2026, 5, 1),
    description: 'Rent',
    expense: 1000,
    currency: 'PLN',
    severity: 'MEDIUM',
    frequency: FREQUENCY.MONTHLY,
    execution,
  });

const seedDutyOn = (executionDate: Date, fields: { hash: string; resolved?: boolean }) =>
  documentSession.put('duties', {
    id: fields.hash,
    hash: fields.hash,
    createdAt: new Date(2026, 5, 1),
    executionDate,
    frequency: FREQUENCY.MONTHLY,
    expenseId: 'expense-1',
    resolved: fields.resolved,
  });

const dutyDaysInJuly = async () =>
  (await db.duties.toArray())
    .map((duty) => new Date(duty.executionDate).getDate())
    .sort((a, b) => a - b);

describe('addDBDutiesForDateRange', () => {
  beforeEach(async () => {
    await documentDb.documents.clear();
    await db.duties.clear();
    await db.expenses.clear();
    await documentSession.open();
  });

  afterEach(async () => {
    await documentSession.close();
  });

  it('leaves one occurrence when the expense moves to another day of the month', async () => {
    await seedExpenseDueOn(new Date(2026, 6, 20));
    await seedDutyOn(new Date(2026, 6, 4), { hash: 'minted-when-it-was-the-4th' });

    await addDBDutiesForDateRange(JULY, { regenFrom: JULY.startDate });

    expect(await dutyDaysInJuly()).toEqual([20]);
  });

  it('keeps an occurrence that was already paid when the expense moves away from it', async () => {
    await seedExpenseDueOn(new Date(2026, 6, 20));
    await seedDutyOn(new Date(2026, 6, 4), { hash: 'paid-on-the-4th', resolved: true });

    await addDBDutiesForDateRange(JULY, { regenFrom: JULY.startDate });

    expect(await dutyDaysInJuly()).toEqual([4, 20]);
    expect((await db.duties.get('paid-on-the-4th'))?.resolved).toBe(true);
  });
});
