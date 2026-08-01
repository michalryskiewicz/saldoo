import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/database/index.ts';
import { documentDb, documentSession } from '@/database/document/document.container.ts';
import { resolveDutiesForExpense } from '../transactions.ts';
import { FREQUENCY } from '@/constant.ts';

const EXPENSE_ID = 'expense-1';

const seedDailyDuty = (dayOfJuly: number) =>
  documentSession.put('duties', {
    id: `duty-${dayOfJuly}`,
    hash: `duty-${dayOfJuly}`,
    createdAt: new Date(2026, 6, 1),
    executionDate: new Date(2026, 6, dayOfJuly),
    frequency: FREQUENCY.DAILY,
    expenseId: EXPENSE_ID,
  });

const seedPayment = (id: string, transactionDate: string) =>
  documentSession.put('transactions', {
    id,
    hash: id,
    createdAt: new Date(2026, 6, 1),
    sourceBank: 'ING',
    amount: -20,
    currency: 'PLN',
    description: 'Coffee',
    transactionDate,
    expenseId: EXPENSE_ID,
  });

describe('duty settlement', () => {
  beforeEach(async () => {
    await documentDb.documents.clear();
    await db.duties.clear();
    await db.transactions.clear();
    await documentSession.open();
  });

  it('marks one occurrence paid off one payment, not every occurrence in its window', async () => {
    for (const dayOfJuly of [10, 11, 12, 13, 14, 15, 16, 17, 18]) await seedDailyDuty(dayOfJuly);
    await seedPayment('the-only-payment', '2026-07-14');

    await resolveDutiesForExpense(EXPENSE_ID);

    const resolved = (await db.duties.toArray()).filter((duty) => duty.resolved);
    expect(resolved.map((duty) => duty.id)).toEqual(['duty-14']);
  });
});
