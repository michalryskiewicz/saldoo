import { describe, expect, it } from 'vitest';
import { searchDuties } from '../duties-search.service.ts';

const duty = (description: string, executionDate: Date, expense = 1000) => ({
  executionDate,
  expense: { description, expense, survivesIncomeLoss: true },
});

const RENT = duty('Czynsz', new Date(2026, 6, 4));
const COFFEE = duty('Kawa', new Date(2026, 7, 20), 12);
const WASTE = duty('Wywóz śmieci', new Date(2026, 7, 28), 45);
const ROWS = [RENT, COFFEE, WASTE];

const descriptionsOf = (rows: typeof ROWS) => rows.map((row) => row.expense.description);

describe('searchDuties', () => {
  it('finds an occurrence by what the expense is called', () => {
    expect(descriptionsOf(searchDuties(ROWS, 'czynsz'))).toEqual(['Czynsz']);
  });

  it('finds it typed without Polish marks, the way people type quickly', () => {
    expect(descriptionsOf(searchDuties(ROWS, 'wywoz smieci'))).toEqual(['Wywóz śmieci']);
  });

  /**
   * The date is on screen as "4 lip", so that is what somebody types. Searching the stored
   * value would answer nothing to every word the column actually shows.
   */
  it('finds it by the month its due date is written in', () => {
    expect(descriptionsOf(searchDuties(ROWS, 'lip'))).toEqual(['Czynsz']);
  });

  it('finds it by an amount typed without the separator the format inserts', () => {
    expect(descriptionsOf(searchDuties(ROWS, '12'))).toEqual(['Kawa']);
  });

  it('is not a filter when nothing has been typed', () => {
    expect(searchDuties(ROWS, '')).toHaveLength(3);
  });
});
