import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/database/index.ts';
import { documentDb, documentSession } from '@/database/document/document.container.ts';
import { topUpCurrentMonthDuties } from '../duty.ts';
import { FREQUENCY } from '@/constant.ts';

describe('topUpCurrentMonthDuties', () => {
  beforeEach(async () => {
    await documentDb.documents.clear();
    await db.duties.clear();
    await db.expenses.clear();
    await documentSession.open();
  });

  it('generates this month for an expense nobody has viewed the duties of', async () => {
    // The 15th of a long-past month: the expected day is then a literal rather than a
    // second computation of what the generator already computes, and it does not move
    // with the day the suite happens to run on.
    await documentSession.put('expenses', {
      id: 'expense-1',
      createdAt: new Date(2020, 0, 1),
      description: 'Rent',
      expense: 1000,
      currency: 'PLN',
      severity: 'MEDIUM',
      frequency: FREQUENCY.MONTHLY,
      execution: new Date(2020, 0, 15),
    });
    await db.duties.clear();

    await topUpCurrentMonthDuties();

    const days = (await db.duties.toArray()).map((duty) => new Date(duty.executionDate).getDate());
    expect(days).toEqual([15]);
  });
});
