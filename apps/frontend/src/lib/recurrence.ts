import { FREQUENCY } from '@/constant.ts';
import { countWeekdaysInMonth, daysInMonth } from '@/lib/dates.ts';

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
  { frequency, execution }: Recurrence,
  { year, monthIndex }: CalendarMonth
): number => {
  // A monthly recurrence is the one that needs no day: it happens once whichever day it is.
  if (frequency === FREQUENCY.MONTHLY) return 1;

  if (!frequency || !execution) return 0;

  const executedOn = new Date(execution);

  switch (frequency) {
    case FREQUENCY.YEARLY:
      return executedOn.getMonth() === monthIndex ? 1 : 0;
    case FREQUENCY.WEEKLY:
      return countWeekdaysInMonth(year, monthIndex, executedOn.getDay());
    case FREQUENCY.DAILY:
      return daysInMonth(year, monthIndex);
    default:
      return 0;
  }
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
