import { describe, expect, it } from 'vitest';
import {
  carryMarksToMovedOccurrences,
  createDutiesForSelectedDateRange,
  selectStaleDuties,
} from '../duties.service.ts';
import type { DBExpense } from '@/database/expenses.ts';
import { occurrencesInMonth } from '@/lib/recurrence.ts';
import type { DBDuty } from '@/database/duty.ts';
import { FREQUENCY } from '@/constant.ts';

const duty = (overrides: Partial<DBDuty> & { hash: string }): DBDuty => ({
  id: overrides.hash,
  createdAt: new Date('2026-07-01'),
  executionDate: new Date('2026-07-04'),
  frequency: FREQUENCY.MONTHLY,
  expenseId: 'expense-1',
  ...overrides,
});

const JULY = { from: new Date('2026-07-01'), to: new Date('2026-07-31T23:59:59') };

describe('selectStaleDuties', () => {
  it('picks the duty the expense would no longer generate', () => {
    const movedToThe20th = duty({ hash: 'the-4th', executionDate: new Date('2026-07-04') });

    const stale = selectStaleDuties({
      stored: [movedToThe20th],
      expectedHashes: ['the-20th'],
      ...JULY,
    });

    expect(stale).toEqual(['the-4th']);
  });

  it('leaves duties outside the range alone, whatever the range was asked about', () => {
    const generatedOnAnotherDevice = duty({
      hash: 'september',
      executionDate: new Date('2026-09-04'),
    });

    const stale = selectStaleDuties({
      stored: [generatedOnAnotherDevice],
      expectedHashes: [],
      ...JULY,
    });

    expect(stale).toEqual([]);
  });

  it('keeps a stale duty that was already paid, so editing an expense cannot erase a payment', () => {
    const paidBeforeTheExpenseMoved = duty({ hash: 'the-4th', resolved: true });

    const stale = selectStaleDuties({
      stored: [paidBeforeTheExpenseMoved],
      expectedHashes: ['the-20th'],
      ...JULY,
    });

    expect(stale).toEqual([]);
  });

  it('keeps a stale duty the user skipped, for the same reason it keeps a paid one', () => {
    const skipped = duty({ hash: 'the-4th', ignored: true });

    const stale = selectStaleDuties({
      stored: [skipped],
      expectedHashes: ['the-20th'],
      ...JULY,
    });

    expect(stale).toEqual([]);
  });
});

const expense = (fields: Partial<DBExpense>): DBExpense =>
  ({
    id: 'expense-1',
    createdAt: new Date(2026, 0, 1),
    description: 'an expense',
    expense: 100,
    currency: 'PLN',
    severity: null,
    ...fields,
  }) as DBExpense;

const FEBRUARY_2027 = { startDate: new Date(2027, 1, 1), endDate: new Date(2027, 1, 28, 23, 59, 59) };

describe('createDutiesForSelectedDateRange', () => {
  /**
   * The two answers a recurrence gives — the occurrences to tick off and the money they come
   * to — were computed by two engines that never met: a date walker here and a closed form in
   * `lib/recurrence.ts`. Where they disagree, a month's list of duties and the same month's
   * total describe different worlds.
   */
  it.each([FREQUENCY.DAILY, FREQUENCY.WEEKLY, FREQUENCY.MONTHLY, FREQUENCY.YEARLY])(
    'generates as many occurrences for a month as the month is counted to hold (%s)',
    async (frequency) => {
      const leapDay = expense({ frequency, execution: new Date(2024, 1, 29) });

      const duties = await createDutiesForSelectedDateRange({
        expenses: [leapDay],
        ...FEBRUARY_2027,
      });

      expect(duties).toHaveLength(
        occurrencesInMonth(leapDay, { year: 2027, monthIndex: 1 })
      );
    }
  );
});

describe('carryMarksToMovedOccurrences', () => {
  const dailyDuty = (fields: Partial<DBDuty> & { hash: string }): DBDuty =>
    duty({ frequency: FREQUENCY.DAILY, ...fields });

  it('hands a paid mark to the occurrence one day on, when the day it was dated is gone', () => {
    // Daily occurrences were minted a day early: their dates round-tripped through
    // `toISOString`, which moves local midnight into the previous day east of UTC. Correcting
    // that changes the date, and the date is the identity — so the mark has to travel with it.
    // Exactly what the old generator wrote: a date parsed from 'YYYY-MM-DD', which is UTC
    // midnight — 02:00 that morning here in summer. The gap to the corrected occurrence is 22
    // hours, and 23 in winter, so nothing about this may be measured in whole days.
    const markedADayEarly = dailyDuty({
      hash: 'the-30th',
      executionDate: new Date('2026-06-30'),
      resolved: true,
      transactionId: 'the-payment',
    });

    const carried = carryMarksToMovedOccurrences({
      stored: [markedADayEarly],
      expected: [
        {
          hash: 'the-1st',
          executionDate: new Date(2026, 6, 1),
          expenseId: 'expense-1',
          frequency: FREQUENCY.DAILY,
        },
      ],
    });

    expect(carried).toEqual([
      {
        staleId: 'the-30th',
        hash: 'the-1st',
        marks: {
          resolved: true,
          ignored: undefined,
          transactionId: 'the-payment',
          rejectedTransactionIds: undefined,
        },
      },
    ]);
  });

  it('leaves a paid month alone when the user turned that expense into a daily one', () => {
    // Not the app's arithmetic — the person changed the recurrence, and the daily occurrence
    // that happens to fall the next day is a different thing entirely. Both it and the payment
    // are true, and they settle that by skipping one (ADR 0001).
    const paidMonth = duty({
      hash: 'the-30th',
      frequency: FREQUENCY.MONTHLY,
      executionDate: new Date(2026, 5, 30),
      resolved: true,
    });

    const carried = carryMarksToMovedOccurrences({
      stored: [paidMonth],
      expected: [
        {
          hash: 'the-1st',
          executionDate: new Date(2026, 6, 1),
          expenseId: 'expense-1',
          frequency: FREQUENCY.DAILY,
        },
      ],
    });

    expect(carried).toEqual([]);
  });

  it('does not hand a mark to an occurrence that already has a row of its own', () => {
    const markedADayEarly = dailyDuty({
      hash: 'the-30th',
      executionDate: new Date('2026-06-30'),
      ignored: true,
    });
    const alreadyThere = dailyDuty({ hash: 'the-1st', executionDate: new Date(2026, 6, 1) });

    const carried = carryMarksToMovedOccurrences({
      stored: [markedADayEarly, alreadyThere],
      expected: [
        {
          hash: 'the-1st',
          executionDate: new Date(2026, 6, 1),
          expenseId: 'expense-1',
          frequency: FREQUENCY.DAILY,
        },
      ],
    });

    expect(carried).toEqual([]);
  });
});

describe('an interval and the identity of an occurrence', () => {
  const hashesFor = async (fields: Partial<DBExpense>) =>
    (
      await createDutiesForSelectedDateRange({
        expenses: [expense({ frequency: FREQUENCY.MONTHLY, execution: new Date(2026, 6, 15), ...fields })],
        startDate: new Date(2026, 6, 1),
        endDate: new Date(2026, 6, 31, 23, 59, 59),
      })
    ).map((duty) => duty.hash);

  it('gives an occurrence a new identity when the cadence it belongs to changes', async () => {
    // Identity is what regeneration reacts to. An interval that did not join it would leave
    // the occurrences of the old cadence in place beside the new ones.
    expect(await hashesFor({ interval: 3 })).not.toEqual(await hashesFor({}));
  });

  it('leaves the identity of everything entered before intervals existed exactly as it was', async () => {
    // Every stored recurrence means "every one", so saying so out loud may not re-mint it —
    // a changed hash would strand every marked occurrence in the vault.
    expect(await hashesFor({ interval: 1 })).toEqual(await hashesFor({}));
  });
});
