import { describe, expect, it } from 'vitest';
import { peakSpendingDay, spendingByDayOfMonth } from '../monthly-spending.ts';

// August 2026 has 31 days; the 20th is well inside it.
const TODAY = new Date(2026, 7, 20);

const paid = (transactionDate: string, amount: number) => ({ transactionDate, amount });

describe('spendingByDayOfMonth', () => {
  it('gives every day of the month, including the ones nothing happened on', () => {
    // A day with nothing spent is a gap in the row of bars, and the gaps are half of what the
    // card says. Omitted, the chart would draw a run of busy days as though they were adjacent.
    const days = spendingByDayOfMonth([], TODAY);

    expect(days).toHaveLength(31);
    expect(days[0]).toEqual({ day: 1, spent: 0 });
    expect(days[30]).toEqual({ day: 31, spent: 0 });
  });

  it('adds up what left the account on each day', () => {
    const days = spendingByDayOfMonth(
      [paid('2026-08-03', -213.47), paid('2026-08-03', -14.99), paid('2026-08-12', -1980)],
      TODAY
    );

    expect(days[2]).toEqual({ day: 3, spent: 228.46 });
    expect(days[11]).toEqual({ day: 12, spent: 1980 });
  });

  it('counts money leaving and not money arriving', () => {
    // The card asks when money went out. A salary landing on the 9th is not a day of spending,
    // and netting it against that day's payments would report the opposite of what happened.
    const days = spendingByDayOfMonth([paid('2026-08-09', 12500), paid('2026-08-09', -65)], TODAY);

    expect(days[8]).toEqual({ day: 9, spent: 65 });
  });

  it('ignores payments from other months', () => {
    const days = spendingByDayOfMonth([paid('2026-07-03', -500), paid('2026-09-03', -500)], TODAY);

    expect(days.every((day) => day.spent === 0)).toBe(true);
  });

  it('ignores a payment with no date rather than filing it under the first', () => {
    expect(spendingByDayOfMonth([paid('', -500)], TODAY)).toEqual(spendingByDayOfMonth([], TODAY));
  });

  it('follows the length of the month it is given', () => {
    expect(spendingByDayOfMonth([], new Date(2026, 1, 10))).toHaveLength(28);
  });
});

describe('peakSpendingDay', () => {
  it('names the day the most left on', () => {
    const days = spendingByDayOfMonth(
      [paid('2026-08-03', -213.47), paid('2026-08-12', -1980)],
      TODAY
    );

    expect(peakSpendingDay(days)).toEqual({ day: 12, spent: 1980 });
  });

  it('keeps the earlier day when two are equal, since one of them has to be named', () => {
    const days = spendingByDayOfMonth([paid('2026-08-03', -100), paid('2026-08-12', -100)], TODAY);

    expect(peakSpendingDay(days)?.day).toBe(3);
  });

  it('names nothing when nothing was spent', () => {
    expect(peakSpendingDay(spendingByDayOfMonth([], TODAY))).toBeUndefined();
  });
});
