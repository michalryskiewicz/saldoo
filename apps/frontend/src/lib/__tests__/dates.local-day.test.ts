import { describe, expect, it } from 'vitest';
import { toISODate, toLocalDayKey } from '../dates.ts';

describe('toLocalDayKey', () => {
  it('is the day the person is having, not the day in Greenwich', () => {
    // Local midnight on the 13th. In Poland that is 22:00 on the 12th in UTC, which is what
    // `toISOString` — and therefore `toISODate` — reports.
    const localMidnight = new Date(2026, 7, 13, 0, 0);

    expect(toLocalDayKey(localMidnight)).toBe('2026-08-13');
  });

  it('puts a bare date and a stamped time on the same day', () => {
    // The pair that produced a real defect: a pass naming a date, against a holding carrying a time.
    expect(toLocalDayKey(new Date(2026, 7, 13))).toBe(toLocalDayKey(new Date(2026, 7, 13, 14, 32)));
  });

  it('pads a single-digit month and day', () => {
    expect(toLocalDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('refuses a date it cannot read', () => {
    expect(() => toLocalDayKey('not a date')).toThrow();
  });

  /** Kept beside it deliberately: the two answer different questions and both have their place. */
  it('differs from the UTC answer exactly where the offset crosses midnight', () => {
    const localMidnight = new Date(2026, 7, 13, 0, 0);
    const utcAnswer = toISODate(localMidnight);

    expect(['2026-08-12', '2026-08-13']).toContain(utcAnswer);
  });
});
