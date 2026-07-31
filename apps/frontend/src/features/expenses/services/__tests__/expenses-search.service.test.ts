import { describe, expect, it } from 'vitest';
import { FREQUENCY, SEVERITY, STRATEGY_PART } from '@/constant.ts';
import {
  expenseSearchText,
  searchExpenses,
  type SearchableExpense,
} from '../expenses-search.service.ts';

const rent: SearchableExpense = {
  description: 'Czynsz',
  expense: 2500,
  severity: SEVERITY.HIGH,
  frequency: FREQUENCY.MONTHLY,
  // 15 July 2026.
  execution: new Date('2026-07-15T00:00:00'),
  strategyPart: STRATEGY_PART.NEEDS,
  tag: { name: 'MIESZKANIE' },
};

const coffee: SearchableExpense = {
  description: 'Kawa',
  expense: 14.99,
  severity: SEVERITY.LOW,
  frequency: FREQUENCY.DAILY,
  strategyPart: STRATEGY_PART.WANTS,
  tag: { name: 'JEDZENIE' },
};

describe('expenseSearchText', () => {
  it('carries the words on the screen, not the values in the database', () => {
    const text = expenseSearchText(rent);

    expect(text).toContain('Czynsz');
    // Stored as HIGH / MONTHLY / NEEDS; read as these.
    expect(text).toContain('Wysoki');
    expect(text).toContain('Miesięczna');
    expect(text).toContain('Potrzeby');
    expect(text).toContain('MIESZKANIE');
  });

  it('includes how the recurrence is phrased in the table', () => {
    expect(expenseSearchText(rent)).toContain('15. dnia miesiąca');
    expect(expenseSearchText(coffee)).toContain('codziennie');
  });

  it('carries the raw amount, which is the one somebody types', () => {
    // The formatted figure has a non-breaking space in it and nobody types one.
    expect(expenseSearchText(rent)).toContain('2500');
  });

  it('leaves out the placeholder dash, which is a mark and not a word', () => {
    // Otherwise typing a hyphen "matches" every row that happens to have no date.
    const bare: SearchableExpense = { description: 'Coś', expense: 0, severity: null };

    expect(expenseSearchText(bare)).toBe('Coś 0');
    expect(searchExpenses([bare], '-')).toEqual([]);
  });
});

describe('searchExpenses', () => {
  const rows = [rent, coffee];

  it('finds a row by its description', () => {
    expect(searchExpenses(rows, 'kawa')).toEqual([coffee]);
  });

  it('finds rows by a priority that is never in the description', () => {
    // This is the whole point of search replacing the priority pills.
    expect(searchExpenses(rows, 'wysoki')).toEqual([rent]);
  });

  it('finds rows by how often they recur', () => {
    expect(searchExpenses(rows, 'codziennie')).toEqual([coffee]);
    expect(searchExpenses(rows, 'miesięczna')).toEqual([rent]);
  });

  it('narrows across fields as more words are typed', () => {
    expect(searchExpenses(rows, 'wysoki czynsz')).toEqual([rent]);
    expect(searchExpenses(rows, 'wysoki kawa')).toEqual([]);
  });

  it('finds a row by its amount', () => {
    expect(searchExpenses(rows, '2500')).toEqual([rent]);
  });

  it('returns everything when nothing has been typed', () => {
    expect(searchExpenses(rows, '')).toEqual(rows);
  });
});
