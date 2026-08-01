import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/database/index.ts';
import { documentDb, documentSession } from '@/database/document/document.container.ts';
import { addDBDutiesForDateRange } from '../duty.ts';
import { FREQUENCY } from '@/constant.ts';

describe('duties re-dated by the day-shift correction', () => {
  beforeEach(async () => {
    await documentDb.documents.clear();
    await db.duties.clear();
    await db.expenses.clear();
    await documentSession.open();
  });

  it('keeps a paid day paid when the correction moves it onto its real date', async () => {
    await documentSession.put('expenses', {
      id: 'expense-1',
      createdAt: new Date(2026, 6, 1),
      description: 'Coffee',
      expense: 20,
      currency: 'PLN',
      severity: null,
      frequency: FREQUENCY.DAILY,
      execution: new Date(2026, 6, 1),
    });

    // What the old generator wrote for the 1st of July: the 30th of June at UTC midnight.
    await documentSession.put('duties', {
      id: 'minted-a-day-early',
      hash: 'minted-a-day-early',
      createdAt: new Date(2026, 6, 1),
      executionDate: new Date('2026-06-30'),
      frequency: FREQUENCY.DAILY,
      expenseId: 'expense-1',
      resolved: true,
      transactionId: 'the-payment',
    });

    await addDBDutiesForDateRange(
      { startDate: new Date(2026, 6, 1), endDate: new Date(2026, 6, 31, 23, 59, 59) },
      { regenFrom: new Date(2026, 6, 1) }
    );

    const duties = await db.duties.toArray();
    const paid = duties.filter((duty) => duty.resolved);

    expect(paid).toHaveLength(1);
    expect(paid[0].executionDate.getDate()).toBe(1);
    expect(paid[0].transactionId).toBe('the-payment');
    expect(duties.filter((duty) => duty.id === 'minted-a-day-early')).toEqual([]);
  });
});
