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

  it('charges a quarterly cost four times a year, not twelve', () => {
    // The whole point of the field: picking the nearest wrong answer propagated into every
    // total built on it — a quarterly premium entered as monthly costs three times what it is.
    const quarterly = { frequency: FREQUENCY.MONTHLY, execution: WEDNESDAY_IN_JULY, interval: 3 };

    expect(costInYear(quarterly, 600, 2026)).toBe(2400);
  });

  it('charges a cost billed every four weeks by the weeks, not by the months', () => {
    // Fourteen payments, because 2026 opens on one and closes on one: the 1st of January plus
    // thirteen 28-day steps is the 31st of December. No monthly reading of this cadence can
    // produce that figure, which is the whole reason the interval had to exist.
    const everyFourWeeks = {
      frequency: FREQUENCY.WEEKLY,
      execution: new Date(2026, 0, 1),
      interval: 4,
    };

    expect(costInYear(everyFourWeeks, 100, 2026)).toBe(1400);
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

  it('counts every N days from the day it was entered on, not every day', () => {
    const dates = occurrencesInRange(
      { frequency: FREQUENCY.DAILY, execution: new Date(2026, 6, 1), interval: 4 },
      { from: new Date(2026, 6, 1), to: new Date(2026, 6, 14) }
    );

    expect(asISODates(dates)).toEqual([
      '2026-07-01',
      '2026-07-05',
      '2026-07-09',
      '2026-07-13',
    ]);
  });

  it('keeps its footing in a range that starts before the day it was entered on', () => {
    // The cadence is anchored to the execution date and runs in both directions from it —
    // asked about an earlier month, it must land on the same days it would have landed on.
    const dates = occurrencesInRange(
      { frequency: FREQUENCY.DAILY, execution: new Date(2026, 6, 13), interval: 4 },
      { from: new Date(2026, 6, 1), to: new Date(2026, 6, 9) }
    );

    expect(asISODates(dates)).toEqual(['2026-07-01', '2026-07-05', '2026-07-09']);
  });

  it('walks a 28-day cycle straight through the end of a month', () => {
    // The cadence a calendar month cannot hold: every four weeks drifts out of the month
    // within a year, which is exactly why picking "monthly" for it was the wrong answer.
    const dates = occurrencesInRange(
      { frequency: FREQUENCY.WEEKLY, execution: new Date(2026, 6, 1), interval: 4 },
      { from: new Date(2026, 6, 1), to: new Date(2026, 9, 1) }
    );

    expect(asISODates(dates)).toEqual([
      '2026-07-01',
      '2026-07-29',
      '2026-08-26',
      '2026-09-23',
    ]);
  });

  it('counts a weekly interval in weeks, not in the days they come to', () => {
    // Seven weeks apart, where counting the interval in days would let every week through:
    // 7 days is a whole multiple of a 7-week interval and nothing would be skipped.
    const dates = occurrencesInRange(
      { frequency: FREQUENCY.WEEKLY, execution: new Date(2026, 6, 1), interval: 7 },
      { from: new Date(2026, 6, 1), to: new Date(2026, 8, 30) }
    );

    expect(asISODates(dates)).toEqual(['2026-07-01', '2026-08-19']);
  });

  it('gives a quarterly cost four dates a year, on the day it was entered on', () => {
    const dates = occurrencesInRange(
      { frequency: FREQUENCY.MONTHLY, execution: new Date(2026, 10, 30), interval: 3 },
      { from: new Date(2027, 0, 1), to: new Date(2027, 11, 31) }
    );

    // Entered on the 30th, so February — which has no 30th — takes the last day it does have.
    expect(asISODates(dates)).toEqual(['2027-02-28', '2027-05-30', '2027-08-30', '2027-11-30']);
  });

  it('gives a cost billed every second year nothing in the year between', () => {
    const everyTwoYears = {
      frequency: FREQUENCY.YEARLY,
      execution: new Date(2026, 6, 15),
      interval: 2,
    };

    expect(occurrencesInRange(everyTwoYears, {
      from: new Date(2028, 0, 1),
      to: new Date(2028, 11, 31),
    })).toHaveLength(1);
    expect(occurrencesInRange(everyTwoYears, {
      from: new Date(2027, 0, 1),
      to: new Date(2027, 11, 31),
    })).toEqual([]);
  });

  it('gives nothing back for a range that ends before it starts', () => {
    const dates = occurrencesInRange(
      { frequency: FREQUENCY.DAILY, execution: WEDNESDAY_IN_JULY },
      { from: new Date(2026, 6, 17), to: new Date(2026, 6, 14) }
    );

    expect(dates).toEqual([]);
  });
});

describe('a recurrence that ends', () => {
  const monthly = { frequency: FREQUENCY.MONTHLY, execution: new Date(2026, 0, 15) };

  it('stops laying down occurrences after the day it was ended on', () => {
    const dates = occurrencesInRange(
      { ...monthly, endsAt: new Date(2026, 2, 20) },
      { from: new Date(2026, 0, 1), to: new Date(2026, 5, 30) }
    );

    expect(asISODates(dates)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('counts the occurrence that falls on the ending day itself', () => {
    // The day a subscription is cancelled is a day it was still owed for.
    const dates = occurrencesInRange(
      { ...monthly, endsAt: new Date(2026, 1, 15) },
      { from: new Date(2026, 1, 1), to: new Date(2026, 5, 30) }
    );

    expect(asISODates(dates)).toEqual(['2026-02-15']);
  });

  it('costs nothing in a year after the one it ended in', () => {
    // The point of the field: a cancelled subscription that goes on being counted is worse
    // than no field at all, because the yearly figure is what makes commitments comparable.
    expect(costInYear({ ...monthly, endsAt: new Date(2026, 2, 20) }, 100, 2027)).toBe(0);
    expect(costInYear({ ...monthly, endsAt: new Date(2026, 2, 20) }, 100, 2026)).toBe(300);
  });
});
