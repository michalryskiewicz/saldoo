import { describe, expect, it } from 'vitest';
import { STRATEGY_PART } from '@/constant.ts';
import {
  type AssignableTransaction,
  transactionAssignments,
} from '../transactions-assignment.service.ts';

describe('transactionAssignments', () => {
  it('names every filing this payment has, in one list', () => {
    const filed: AssignableTransaction = {
      strategyPart: STRATEGY_PART.NEEDS,
      tag: { name: 'JEDZENIE' },
      expense: { description: 'Zakupy spożywcze' },
    };

    expect(transactionAssignments(filed)).toEqual([
      { label: 'Kategoria', value: 'JEDZENIE' },
      { label: 'Kategoria Strategii Budżetu', value: 'Potrzeby' },
      { label: 'Przypisany wydatek', value: 'Zakupy spożywcze' },
    ]);
  });

  it('reads the strategy part as the word on the screen, not the value stored', () => {
    expect(transactionAssignments({ strategyPart: STRATEGY_PART.WANTS })).toEqual([
      { label: 'Kategoria Strategii Budżetu', value: 'Zachcianki' },
    ]);
  });

  it('says nothing at all about a payment nobody has filed', () => {
    // The empty list is what lets the column disappear from a phone's row rather than
    // contributing a separator and no word.
    expect(transactionAssignments({})).toEqual([]);
  });

  it('leaves out the parts that are missing rather than showing a gap for each', () => {
    expect(transactionAssignments({ tag: { name: 'TRANSPORT' } })).toEqual([
      { label: 'Kategoria', value: 'TRANSPORT' },
    ]);
  });

  it('treats a category with no name as no category', () => {
    expect(transactionAssignments({ tag: { name: '' } })).toEqual([]);
  });
});
