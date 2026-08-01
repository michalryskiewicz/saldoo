import { describe, expect, it } from 'vitest';
import { FREQUENCY } from '@/constant.ts';
import { profitSearchText, searchProfits, type SearchableProfit } from '../profits-search.service.ts';

const salary: SearchableProfit = {
  description: 'Wynagrodzenie',
  profit: 12500,
  frequency: FREQUENCY.MONTHLY,
  // 15 July 2026.
  execution: new Date('2026-07-15T00:00:00'),
};

const interest: SearchableProfit = {
  description: 'Odsetki z lokaty',
  profit: 84.2,
  frequency: FREQUENCY.YEARLY,
  execution: new Date('2026-08-15T00:00:00'),
};

describe('profitSearchText', () => {
  it('carries the words on the screen, not the values in the database', () => {
    const text = profitSearchText(salary);

    expect(text).toContain('Wynagrodzenie');
    // Stored as MONTHLY; read as this.
    expect(text).toContain('Miesięczna');
  });

  it('includes how the recurrence is phrased in the table', () => {
    expect(profitSearchText(salary)).toContain('15. dnia miesiąca');
    expect(profitSearchText(interest)).toContain('15 sierpnia');
  });

  it('carries the raw amount, which is the one somebody types', () => {
    // The formatted figure has a non-breaking space in it and nobody types one.
    expect(profitSearchText(salary)).toContain('12500');
  });

  it('leaves out the placeholder dash, which is a mark and not a word', () => {
    // Otherwise typing a hyphen "matches" every row that happens to have no date.
    const bare: SearchableProfit = { description: 'Coś', profit: 0 };

    expect(profitSearchText(bare)).toBe('Coś 0');
    expect(searchProfits([bare], '-')).toEqual([]);
  });
});

describe('searchProfits', () => {
  const rows = [salary, interest];

  it('finds a row by its description', () => {
    expect(searchProfits(rows, 'odsetki')).toEqual([interest]);
  });

  it('finds rows by how often they recur', () => {
    expect(searchProfits(rows, 'miesięczna')).toEqual([salary]);
  });

  it('finds a row typed without its diacritics', () => {
    expect(searchProfits(rows, 'wynagrodzenie')).toEqual([salary]);
    expect(searchProfits(rows, 'cos')).toEqual([]);
  });

  it('narrows across fields as more words are typed', () => {
    expect(searchProfits(rows, 'roczna odsetki')).toEqual([interest]);
    expect(searchProfits(rows, 'roczna wynagrodzenie')).toEqual([]);
  });

  it('finds a row by its amount', () => {
    expect(searchProfits(rows, '12500')).toEqual([salary]);
  });

  it('returns everything when nothing has been typed', () => {
    expect(searchProfits(rows, '')).toEqual(rows);
  });
});
