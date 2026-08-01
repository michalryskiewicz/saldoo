import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/database/index.ts';
import { documentDb, documentSession } from '@/database/document/document.container.ts';
import { addDBDutiesForDateRange } from '../duty.ts';
import { FREQUENCY } from '@/constant.ts';

/**
 * That a yearly cost has an occurrence in every year, not only the one it was entered in.
 *
 * Generation used to filter the expenses first, by asking whether the execution date itself fell
 * inside the range asked about — which for a yearly cost is true in one year and false in every
 * year after it. The totals charged for it annually the whole time, so the list of things to pay
 * and the figure describing them disagreed by a whole insurance premium.
 */
describe('a yearly expense in a later year', () => {
  beforeEach(async () => {
    await documentDb.documents.clear();
    await db.duties.clear();
    await db.expenses.clear();
    await documentSession.open();
  });

  it('is owed again in July 2027 when it was entered in July 2024', async () => {
    await documentSession.put('expenses', {
      id: 'expense-1',
      createdAt: new Date(2024, 6, 15),
      description: 'Ubezpieczenie',
      expense: 1980,
      currency: 'PLN',
      severity: null,
      frequency: FREQUENCY.YEARLY,
      execution: new Date(2024, 6, 15),
    });

    await addDBDutiesForDateRange({
      startDate: new Date(2027, 6, 1),
      endDate: new Date(2027, 6, 31, 23, 59, 59),
    });

    expect(await db.duties.toArray()).toHaveLength(1);
  });
});
