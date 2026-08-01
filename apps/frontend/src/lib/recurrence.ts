import { FREQUENCY } from '@/constant.ts';
import { daysInMonth } from '@/lib/dates.ts';
import { differenceInCalendarDays } from 'date-fns';

/** A thing that repeats: how often, the day it repeats on, and how many of those it skips. */
export type Recurrence = {
  frequency?: FREQUENCY;
  execution?: Date | string;
  /**
   * How many units of the frequency lie between occurrences — every 4 weeks, every 3 months.
   *
   * Absent means every one, which is what every recurrence entered before this existed meant.
   * The unit stays in `frequency`, so this is `FREQ`/`INTERVAL` and no more of RRULE than that.
   */
  interval?: number;
  /**
   * The last day it recurs on, if it has one — a subscription cancelled, a loan paid off.
   *
   * Absent means it goes on, which is what everything stored before this meant. Ending a series
   * is not deleting it: the occurrences up to this day stay exactly as they were, and so does
   * the record of which of them were paid.
   */
  endsAt?: Date | string;
};

/** One month of one year. The year matters — Februaries differ, and so do weekday counts. */
export type CalendarMonth = {
  year: number;
  monthIndex: number;
};

/** A stretch of time a recurrence is asked to lay its occurrences over. */
export type DateRange = { from: Date; to: Date };

/**
 * The day of a month, or the last day it has.
 *
 * A cost due on the 31st has no February. Built straight from the day, `new Date(2027, 1, 31)`
 * is the 3rd of March — outside the month asked about, so the month simply had no such cost in
 * it and nothing said so.
 */
const dayInMonth = (year: number, monthIndex: number, dayOfMonth: number): Date =>
  new Date(year, monthIndex, Math.min(dayOfMonth, daysInMonth(year, monthIndex)));

/**
 * Whether a step away from the anchor lands on the cadence.
 *
 * Counted in both directions — a range earlier than the day the cost was entered on lands on
 * the days the cadence would have landed on — which the remainder handles on its own: a
 * negative multiple divides exactly as a positive one does.
 */
const onTheCadence = (stepsFromAnchor: number, interval: number): boolean =>
  stepsFromAnchor % interval === 0;

/**
 * The stretch a recurrence may actually lay occurrences over, once its own ending is counted.
 *
 * The ending day counts — a subscription cancelled on the 15th was owed on the 15th. Comparing
 * instants is enough for that because occurrences are minted at local midnight, so one on the
 * ending day is never later than the ending day itself.
 */
const untilItEnds = ({ from, to }: DateRange, endsAt?: Date | string): DateRange => {
  if (!endsAt) return { from, to };

  const lastDay = new Date(endsAt);

  return { from, to: lastDay < to ? lastDay : to };
};

/**
 * Every date a recurrence falls on inside a range.
 *
 * The dates themselves rather than a count of them: an occurrence is a thing a person marks
 * paid or skips, so the duty generator needs the dates, and a count is what is left when you
 * ask how many there were. An interval is also why a count cannot be had any other way — every
 * fourth week has no closed form, only an anchor and a step.
 */
export const occurrencesInRange = (
  { frequency, execution, interval, endsAt }: Recurrence,
  range: DateRange
): Date[] => {
  if (!frequency || !execution) return [];

  const { from, to } = untilItEnds(range, endsAt);
  const executedOn = new Date(execution);
  const every = Math.max(1, Math.trunc(interval ?? 1));
  const dates: Date[] = [];

  if (frequency === FREQUENCY.YEARLY) {
    for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
      if (!onTheCadence(year - executedOn.getFullYear(), every)) continue;

      const date = dayInMonth(year, executedOn.getMonth(), executedOn.getDate());

      if (date >= from && date <= to) dates.push(date);
    }

    return dates;
  }

  if (frequency === FREQUENCY.MONTHLY) {
    for (
      let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
      cursor <= to;
      cursor.setMonth(cursor.getMonth() + 1)
    ) {
      const monthsFromAnchor =
        (cursor.getFullYear() - executedOn.getFullYear()) * 12 +
        (cursor.getMonth() - executedOn.getMonth());

      if (!onTheCadence(monthsFromAnchor, every)) continue;

      const date = dayInMonth(cursor.getFullYear(), cursor.getMonth(), executedOn.getDate());

      if (date >= from && date <= to) dates.push(date);
    }

    return dates;
  }

  for (
    let cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    cursor <= to;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const daysFromAnchor = differenceInCalendarDays(cursor, executedOn);

    if (frequency === FREQUENCY.WEEKLY) {
      if (cursor.getDay() !== executedOn.getDay()) continue;
      if (!onTheCadence(daysFromAnchor / 7, every)) continue;
    } else if (!onTheCadence(daysFromAnchor, every)) continue;

    dates.push(new Date(cursor));
  }

  return dates;
};

/**
 * How many times a recurrence falls inside one month.
 *
 * The one rule for turning a plan into what it actually costs in a period, and the only copy.
 * There were eight: five `switch`es in `lib/expenses.ts`, one in `lib/profits.ts`, one in the
 * duty generator and this — each with slightly different guards, none of them used by the
 * totals under the tables, which is why the expenses table added a weekly cost to a yearly one
 * and called the result "Całkowita".
 *
 * Counted by walking the month rather than by a formula per frequency. An interval has no
 * closed form — every fourth week is an anchor and a step — and a count that disagreed with the
 * occurrences the duty generator produced is the drift that made a month's list and the same
 * month's total describe different worlds.
 *
 * The year comes from the month being asked about rather than from the execution date. Every
 * copy but one took it from the execution, so a cost entered in a leap year went on being
 * counted against that February forever.
 */
export const occurrencesInMonth = (
  recurrence: Recurrence,
  { year, monthIndex }: CalendarMonth
): number => {
  // A monthly recurrence is the one that needs no day: it happens once whichever day it is.
  if (recurrence.frequency === FREQUENCY.MONTHLY && !recurrence.execution) return 1;

  return occurrencesInRange(recurrence, {
    from: new Date(year, monthIndex, 1),
    to: new Date(year, monthIndex, daysInMonth(year, monthIndex), 23, 59, 59),
  }).length;
};

/** What a recurring amount comes to over one month — the figure a total may add up. */
export const costInMonth = (
  recurrence: Recurrence,
  amount: number | undefined,
  month: CalendarMonth
): number => Number(((amount ?? 0) * occurrencesInMonth(recurrence, month)).toFixed(2));

/**
 * What a recurring amount comes to over a whole year.
 *
 * Exact rather than averaged: twelve months of counted occurrences, so a leap year costs a
 * day more of a daily habit and a year with fifty-three Wednesdays costs one more week of a
 * weekly one. It is the figure that makes a list of commitments comparable — a daily coffee and
 * a yearly insurance premium cannot be ranked against each other in any shorter window, and
 * over a single month eleven twelfths of the yearly ones read as zero.
 */
export const costInYear = (
  recurrence: Recurrence,
  amount: number | undefined,
  year: number
): number =>
  Number(
    Array.from({ length: 12 }, (_, monthIndex) =>
      costInMonth(recurrence, amount, { year, monthIndex })
    )
      .reduce((total, month) => total + month, 0)
      .toFixed(2)
  );
