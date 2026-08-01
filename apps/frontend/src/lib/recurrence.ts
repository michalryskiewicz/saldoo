import { FREQUENCY } from '@/constant.ts';
import { daysInMonth } from '@/lib/dates.ts';

/** A thing that repeats: how often, and the day it repeats on. */
export type Recurrence = {
  frequency?: FREQUENCY;
  execution?: Date | string;
};

/** One month of one year. The year matters — Februaries differ, and so do weekday counts. */
export type CalendarMonth = {
  year: number;
  monthIndex: number;
};

/** A stretch of time a recurrence is asked to lay its occurrences over. */
export type DateRange = { from: Date; to: Date };

/**
 * Every date a recurrence falls on inside a range.
 *
 * The dates themselves rather than a count of them: an occurrence is a thing a person marks
 * paid or skips, so the duty generator needs the dates, and a count is what is left when you
 * ask how many there were.
 */
/**
 * The day of a month, or the last day it has.
 *
 * A cost due on the 31st has no February. Built straight from the day, `new Date(2027, 1, 31)`
 * is the 3rd of March — outside the month asked about, so the month simply had no such cost in
 * it and nothing said so.
 */
const dayInMonth = (year: number, monthIndex: number, dayOfMonth: number): Date =>
  new Date(year, monthIndex, Math.min(dayOfMonth, daysInMonth(year, monthIndex)));

export const occurrencesInRange = (
  { frequency, execution }: Recurrence,
  { from, to }: DateRange
): Date[] => {
  if (!frequency || !execution) return [];

  const executedOn = new Date(execution);
  const dates: Date[] = [];

  if (frequency === FREQUENCY.YEARLY) {
    for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
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
    if (frequency === FREQUENCY.WEEKLY && cursor.getDay() !== executedOn.getDay()) continue;

    dates.push(new Date(cursor));
  }

  return dates;
};

/**
 * How many times a recurrence falls inside one month.
 *
 * The one rule for turning a plan into what it actually costs in a period, and the only copy.
 * There were six: five `switch`es in `lib/expenses.ts` and one in `lib/profits.ts`, each with
 * slightly different guards, none of them used by the totals under the tables — which is why the
 * expenses table added a weekly cost to a yearly one and called the result "Całkowita".
 *
 * The year comes from the month being asked about rather than from the execution date. Every
 * copy but one took it from the execution, so a cost entered in a leap year went on being
 * counted against that February forever; the odd one out used the current year, which was right
 * by accident and only while the chart showed this year.
 *
 * A yearly recurrence lands in its own *month*, in any year: that is what yearly means.
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
