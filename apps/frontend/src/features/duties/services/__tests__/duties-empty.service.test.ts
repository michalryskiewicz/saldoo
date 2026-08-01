import { describe, expect, it } from 'vitest';
import { dutiesEmptyReason } from '../duties-empty.service.ts';

describe('dutiesEmptyReason', () => {
  it('says nothing at all when there are rows to look at', () => {
    expect(dutiesEmptyReason({ hasExpenses: true, dutiesInRange: 3, visibleRows: 3 })).toBeNull();
  });

  /**
   * Three empties that look identical and mean different things. Sending someone from the
   * second case to "add an expense" is the worst of the three: they add a second insurance
   * because the screen implied they had none.
   */
  it('has nothing to generate from when no expense exists yet', () => {
    expect(dutiesEmptyReason({ hasExpenses: false, dutiesInRange: 0, visibleRows: 0 })).toBe(
      'no-expenses'
    );
  });

  it('blames the month when expenses exist but none of them falls in it', () => {
    expect(dutiesEmptyReason({ hasExpenses: true, dutiesInRange: 0, visibleRows: 0 })).toBe(
      'none-in-range'
    );
  });

  it('blames the filter when the month holds occurrences and none survived it', () => {
    expect(dutiesEmptyReason({ hasExpenses: true, dutiesInRange: 5, visibleRows: 0 })).toBe(
      'filtered'
    );
  });
});
