import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/database/index.ts';
import { documentDb, documentSession } from '@/database/document/document.container.ts';
import { addDBDutiesForDateRange, ignoreDBDuty, resolveDBDuty } from '../duty.ts';
import { resolveDutiesForExpense } from '../transactions.ts';
import { FREQUENCY } from '@/constant.ts';

const DUTY_ID = 'duty-1';

const seedDuty = (fields: { resolved?: boolean; transactionId?: string } = {}) =>
  documentSession.put('duties', {
    id: DUTY_ID,
    hash: DUTY_ID,
    createdAt: new Date(2026, 5, 1),
    executionDate: new Date(2026, 6, 15),
    frequency: FREQUENCY.MONTHLY,
    expenseId: 'expense-1',
    ...fields,
  });

describe('duty marks', () => {
  beforeEach(async () => {
    await documentDb.documents.clear();
    await db.duties.clear();
    await db.transactions.clear();
    await documentSession.open();
  });

  it('records which payment was wrong when a matched occurrence is unticked', async () => {
    await seedDuty({ resolved: true, transactionId: 'transaction-1' });

    await resolveDBDuty(DUTY_ID, false);

    const duty = await db.duties.get(DUTY_ID);
    expect(duty?.resolved).toBe(false);
    expect(duty?.transactionId).toBeFalsy();
    expect(duty?.rejectedTransactionIds).toEqual(['transaction-1']);
  });

  it('leaves an occurrence alone on re-import when its match was rejected', async () => {
    await seedDuty({ resolved: false });
    await documentSession.update('duties', DUTY_ID, {
      rejectedTransactionIds: ['transaction-1'],
    });
    await documentSession.put('transactions', {
      id: 'transaction-1',
      createdAt: new Date(2026, 6, 14),
      hash: 'transaction-1',
      sourceBank: 'ING',
      amount: -1000,
      currency: 'PLN',
      description: 'Rent',
      transactionDate: '2026-07-14',
      expenseId: 'expense-1',
    });

    await resolveDutiesForExpense('expense-1');

    expect((await db.duties.get(DUTY_ID))?.resolved).toBeFalsy();
  });

  /**
   * The mark this replaced a delete with. Deleting could not express it: the row's identity
   * is computed from the expense, so regeneration mints the same row again and the toast
   * that said it was gone was wrong by the next change of month.
   */
  it('keeps an occurrence skipped when its range is regenerated', async () => {
    await seedDuty();

    await ignoreDBDuty(DUTY_ID, true);
    await addDBDutiesForDateRange(
      { startDate: new Date(2026, 6, 1), endDate: new Date(2026, 6, 31, 23, 59, 59) },
      { regenFrom: new Date(2026, 6, 1) }
    );

    expect((await db.duties.get(DUTY_ID))?.ignored).toBe(true);
  });
});
