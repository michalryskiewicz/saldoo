import { describe, expect, it } from 'vitest';
import { STRATEGY_PART } from '@/constant.ts';
import {
  type SearchableTransaction,
  searchTransactions,
  transactionSearchText,
} from '../transactions-search.service.ts';

const groceries: SearchableTransaction = {
  description: 'BIEDRONKA 1234 WARSZAWA',
  amount: -213.47,
  transactionDate: '2026-07-03',
  strategyPart: STRATEGY_PART.NEEDS,
  tag: { name: 'JEDZENIE' },
  expense: { description: 'Zakupy spożywcze' },
};

const salary: SearchableTransaction = {
  description: 'Przelew przychodzacy - wynagrodzenie',
  amount: 12500,
  transactionDate: '2026-07-09',
};

describe('transactionSearchText', () => {
  it('carries the words on the screen, not the values in the database', () => {
    const text = transactionSearchText(groceries);

    expect(text).toContain('BIEDRONKA');
    expect(text).toContain('JEDZENIE');
    // Stored as NEEDS; read as this.
    expect(text).toContain('Potrzeby');
    expect(text).toContain('Zakupy spożywcze');
  });

  it('carries the date the way the column writes it', () => {
    expect(transactionSearchText(groceries)).toContain('03.07.2026');
  });

  it('carries the raw amount, which is the one somebody types', () => {
    // The formatted figure has a non-breaking space in it and nobody types one.
    expect(transactionSearchText(salary)).toContain('12500');
  });

  it('says nothing about the columns a payment has not been filed under', () => {
    // An unassigned payment must not answer to every word: it has no category, no part and no
    // expense, and a blank is not a match for anything.
    expect(transactionSearchText(salary)).toBe('Przelew przychodzacy - wynagrodzenie 09.07.2026 12500');
  });
});

describe('searchTransactions', () => {
  const rows = [groceries, salary];

  it('finds a row by a word from its title', () => {
    expect(searchTransactions(rows, 'biedronka')).toEqual([groceries]);
  });

  it('finds a row by the category it was filed under, which is never in the title', () => {
    expect(searchTransactions(rows, 'jedzenie')).toEqual([groceries]);
  });

  it('finds a row by the expense it settles', () => {
    expect(searchTransactions(rows, 'spozywcze')).toEqual([groceries]);
  });

  it('narrows across fields as more words are typed', () => {
    expect(searchTransactions(rows, 'potrzeby biedronka')).toEqual([groceries]);
    expect(searchTransactions(rows, 'potrzeby wynagrodzenie')).toEqual([]);
  });

  it('returns everything when nothing has been typed', () => {
    expect(searchTransactions(rows, '')).toEqual(rows);
  });
});
