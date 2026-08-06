import { describe, expect, it } from 'vitest';
import { formatMonthAndYear } from '../goal-copy.service.ts';

describe('formatMonthAndYear', () => {
  /**
   * A completion date is read as *when*, not as a day. "Ready by 14 September 2027" invites a
   * precision the figure does not have — the date came out of dividing by a monthly pace, so the
   * month is the whole of what is known.
   */
  it('says the month and the year, and not the day', () => {
    expect(formatMonthAndYear(new Date(2027, 8, 14))).toBe('Wrzesień 2027');
  });

  it('carries the year, because the same month comes round again', () => {
    expect(formatMonthAndYear(new Date(2028, 8, 1))).toBe('Wrzesień 2028');
  });
});
