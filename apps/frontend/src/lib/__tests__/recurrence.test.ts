import { describe, expect, it } from 'vitest';
import { FREQUENCY } from '@/constant.ts';
import { costInYear, occurrencesInMonth, occurrencesInRange } from '../recurrence.ts';
import { format } from 'date-fns';

// A Wednesday. July 2026 holds five of them, August four.
const WEDNESDAY_IN_JULY = new Date(2026, 6, 15);

const july2026 = { year: 2026, monthIndex: 6 };
const august2026 = { year: 2026, monthIndex: 7 };
const february2026 = { year: 2026, monthIndex: 1 };
const february2024 = { year: 2024, monthIndex: 1 };

describe('occurrencesInMonth', () => {
  it('counts a monthly recurrence once, in every month', () => {
    const monthly = { frequency: FREQUENCY.MONTHLY, execution: WEDNESDAY_IN_JULY };

    expect(occurrencesInMonth(monthly, july2026)).toBe(1);
    expect(occurrencesInMonth(monthly, february2026)).toBe(1);
  });

  it('counts a yearly recurrence in its own month and nowhere else', () => {
    const yearly = { frequency: FREQUENCY.YEARLY, execution: WEDNESDAY_IN_JULY };

    expect(occurrencesInMonth(yearly, july2026)).toBe(1);
    expect(occurrencesInMonth(yearly, august2026)).toBe(0);
  });

  it('counts a yearly recurrence in that month of any year, which is what yearly means', () => {
    const yearly = { frequency: FREQUENCY.YEARLY, execution: new Date(2024, 6, 15) };

    expect(occurrencesInMonth(yearly, { year: 2027, monthIndex: 6 })).toBe(1);
  });

  it('counts a weekly recurrence as often as its weekday comes round', () => {
    const weekly = { frequency: FREQUENCY.WEEKLY, execution: WEDNESDAY_IN_JULY };

    expect(occurrencesInMonth(weekly, july2026)).toBe(5);
    expect(occurrencesInMonth(weekly, august2026)).toBe(4);
  });

  it('counts a daily recurrence once per day of the month', () => {
    const daily = { frequency: FREQUENCY.DAILY, execution: WEDNESDAY_IN_JULY };

    expect(occurrencesInMonth(daily, july2026)).toBe(31);
    expect(occurrencesInMonth(daily, february2026)).toBe(28);
  });

  it('reads the length of the month from the year being asked about', () => {
    // The year the recurrence *started* decides nothing about how long February is now. Every
    // caller used to take the year off the execution date, so a cost entered in 2026 was still
    // being counted against 2026's February in 2028.
    const daily = { frequency: FREQUENCY.DAILY, execution: WEDNESDAY_IN_JULY };

    expect(occurrencesInMonth(daily, february2024)).toBe(29);
  });

  it('reads the weekday count from the year being asked about too', () => {
    const weekly = { frequency: FREQUENCY.WEEKLY, execution: WEDNESDAY_IN_JULY };

    // Five Wednesdays in January 2025, four in January 2026.
    expect(occurrencesInMonth(weekly, { year: 2025, monthIndex: 0 })).toBe(5);
    expect(occurrencesInMonth(weekly, { year: 2026, monthIndex: 0 })).toBe(4);
  });

  it('counts nothing for a recurrence with no day to recur on', () => {
    expect(occurrencesInMonth({ frequency: FREQUENCY.WEEKLY }, july2026)).toBe(0);
    expect(occurrencesInMonth({ frequency: FREQUENCY.YEARLY }, july2026)).toBe(0);
  });

  it('counts nothing when there is no recurrence at all', () => {
    expect(occurrencesInMonth({ execution: WEDNESDAY_IN_JULY }, july2026)).toBe(0);
  });

  it('counts a monthly recurrence even with no date, since every month holds one', () => {
    // The one frequency that does not need a day: it happens once a month whichever day it is.
    expect(occurrencesInMonth({ frequency: FREQUENCY.MONTHLY }, july2026)).toBe(1);
  });
});

describe('costInYear', () => {
  const perYear = (frequency: FREQUENCY, amount: number, year = 2026) =>
    costInYear({ frequency, execution: WEDNESDAY_IN_JULY }, amount, year);

  it('counts a yearly cost once', () => {
    expect(perYear(FREQUENCY.YEARLY, 1980)).toBe(1980);
  });

  it('counts a monthly cost twelve times', () => {
    expect(perYear(FREQUENCY.MONTHLY, 2500)).toBe(30000);
  });

  it('counts a daily cost once per day of the year', () => {
    expect(perYear(FREQUENCY.DAILY, 10)).toBe(3650);
    // A leap year is a day longer, and the figure says so.
    expect(perYear(FREQUENCY.DAILY, 10, 2024)).toBe(3660);
  });

  it('counts a weekly cost once per time its weekday comes round that year', () => {
    // A year holds 53 of whichever weekday it opens on and 52 of the rest. 2026 opens on a
    // Thursday, so its Wednesdays number 52; 2025 opens on a Wednesday, so its number 53.
    expect(perYear(FREQUENCY.WEEKLY, 100)).toBe(5200);
    expect(perYear(FREQUENCY.WEEKLY, 100, 2025)).toBe(5300);
  });

  it('is nothing for a cost that never recurs', () => {
    expect(costInYear({ execution: WEDNESDAY_IN_JULY }, 500, 2026)).toBe(0);
  });

  it('is nothing for no amount', () => {
    expect(costInYear({ frequency: FREQUENCY.MONTHLY }, undefined, 2026)).toBe(0);
  });
});

const asISODates = (dates: Date[]) => dates.map((date) => format(date, 'yyyy-MM-dd'));

describe('occurrencesInRange', () => {
  it('gives a daily recurrence one date per day of the range', () => {
    const dates = occurrencesInRange(
      { frequency: FREQUENCY.DAILY, execution: WEDNESDAY_IN_JULY },
      { from: new Date(2026, 6, 14), to: new Date(2026, 6, 17) }
    );

    expect(asISODates(dates)).toEqual(['2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17']);
  });

  it('gives a weekly recurrence the days its weekday comes round on', () => {
    const dates = occurrencesInRange(
      { frequency: FREQUENCY.WEEKLY, execution: WEDNESDAY_IN_JULY },
      { from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) }
    );

    expect(asISODates(dates)).toEqual([
      '2026-07-01',
      '2026-07-08',
      '2026-07-15',
      '2026-07-22',
      '2026-07-29',
    ]);
  });

  it('lands a monthly recurrence on the last day a month has, when it has no such day', () => {
    // Rent due on the 31st. Built straight from the day, February's would be the 3rd of March
    // — outside the month, so the month simply had no rent in it and nothing said so.
    const dates = occurrencesInRange(
      { frequency: FREQUENCY.MONTHLY, execution: new Date(2026, 0, 31) },
      { from: new Date(2027, 0, 1), to: new Date(2027, 3, 30) }
    );

    expect(asISODates(dates)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });

  it('gives a yearly recurrence its own day, once a year', () => {
    const dates = occurrencesInRange(
      { frequency: FREQUENCY.YEARLY, execution: new Date(2024, 1, 29) },
      { from: new Date(2026, 0, 1), to: new Date(2028, 11, 31) }
    );

    // Entered on a leap day, which most years do not have. It falls on the last day February
    // holds rather than slipping into March.
    expect(asISODates(dates)).toEqual(['2026-02-28', '2027-02-28', '2028-02-29']);
  });

  it('gives nothing back for a range that ends before it starts', () => {
    const dates = occurrencesInRange(
      { frequency: FREQUENCY.DAILY, execution: WEDNESDAY_IN_JULY },
      { from: new Date(2026, 6, 17), to: new Date(2026, 6, 14) }
    );

    expect(dates).toEqual([]);
  });
});
