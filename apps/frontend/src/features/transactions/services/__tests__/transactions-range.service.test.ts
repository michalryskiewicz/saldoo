import { describe, expect, it } from 'vitest';
import { selectTransactionsInRange } from '../transactions-range.service.ts';

// A day well inside a month, so neither boundary is the one being read by accident.
const TODAY = new Date(2026, 6, 20);

const dated = (transactionDate: string) => ({ transactionDate });

const rows = [
  dated('2026-05-31'),
  dated('2026-06-01'),
  dated('2026-06-30'),
  dated('2026-07-01'),
  dated('2026-07-20'),
  dated('2026-08-01'),
];

describe('selectTransactionsInRange', () => {
  it('is not a filter at all over the entire period', () => {
    expect(selectTransactionsInRange(rows, 'all', TODAY)).toEqual(rows);
  });

  it('keeps this month from its first day to its last', () => {
    expect(selectTransactionsInRange(rows, 'this-month', TODAY)).toEqual([
      dated('2026-07-01'),
      dated('2026-07-20'),
    ]);
  });

  it('keeps the previous month whole, both ends included', () => {
    // The last day of a month is where an off-by-one hides: an end read as midnight drops
    // everything booked on the 30th.
    expect(selectTransactionsInRange(rows, 'previous-month', TODAY)).toEqual([
      dated('2026-06-01'),
      dated('2026-06-30'),
    ]);
  });

  it('steps back across a year boundary', () => {
    const january = new Date(2026, 0, 15);
    const december = [dated('2025-12-24'), dated('2026-01-02')];

    expect(selectTransactionsInRange(december, 'previous-month', january)).toEqual([
      dated('2025-12-24'),
    ]);
  });

  it('leaves out a payment with no date rather than guessing one', () => {
    const undatedRow = { transactionDate: '' };

    expect(selectTransactionsInRange([undatedRow], 'this-month', TODAY)).toEqual([]);
    // Under "everything" it is still a payment and still shown.
    expect(selectTransactionsInRange([undatedRow], 'all', TODAY)).toEqual([undatedRow]);
  });
});
