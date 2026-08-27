import { describe, expect, it } from 'vitest';
import { STRATEGY_PART } from '@/constant.ts';
import type { DBTransaction } from '@/database/transactions.ts';
import { toSheetRows } from '@/features/transactions/services/sheet-export.service.ts';

/**
 * What the export writes out for each reference: the name, and never the id.
 *
 * Ids for the transaction itself and names for everything it points at is the only combination that
 * works on both ends — nobody recognises a uuid for a category, and no import can recognise a
 * transaction without one.
 */

const names = {
  tags: new Map([['tag-food', 'Jedzenie']]),
  goals: new Map([['goal-ike', 'IKE']]),
  expenses: new Map([['exp-rent', 'Czynsz']]),
};

const transaction = (over: Partial<DBTransaction> = {}): DBTransaction => ({
  id: 'tx-1',
  createdAt: new Date('2026-07-02T10:00:00Z'),
  sourceBank: 'ING',
  amount: -213.47,
  currency: 'PLN',
  transactionDate: '2026-07-02',
  description: 'BIEDRONKA 1234',
  hash: 'h1',
  ...over,
});

describe('transactions as sheet rows', () => {
  it('writes each reference as the name it has on screen', () => {
    const [row] = toSheetRows(
      [transaction({ tagId: 'tag-food', goalId: 'goal-ike', expenseId: 'exp-rent', strategyPart: STRATEGY_PART.NEEDS })],
      names
    );

    expect(row).toEqual({
      id: 'tx-1',
      transactionDate: '2026-07-02',
      description: 'BIEDRONKA 1234',
      amount: -213.47,
      currency: 'PLN',
      category: 'Jedzenie',
      goal: 'IKE',
      expense: 'Czynsz',
      budgetPart: STRATEGY_PART.NEEDS,
    });
  });

  it('leaves the cell empty when the record a payment points at is gone', () => {
    // An id in a name column would come back as an unknown name, and the report would blame the
    // person for a cell they never typed.
    const [row] = toSheetRows([transaction({ tagId: 'tag-deleted' })], names);

    expect(row.category).toBeUndefined();
  });

  it('keeps the payment in the currency it was made in', () => {
    const [row] = toSheetRows([transaction({ amount: -40, currency: 'EUR' })], names);

    expect(row).toMatchObject({ amount: -40, currency: 'EUR' });
  });
});
