import { describe, expect, it } from 'vitest';
import { FREQUENCY } from '@/constant.ts';
import { costInYear, occurrencesInMonth } from '../recurrence.ts';

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
