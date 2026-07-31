import { describe, expect, it } from 'vitest';
import { selectStaleDuties } from '../duties.service.ts';
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
});
