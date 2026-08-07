import { formatMonth } from '@/lib/formats.ts';
import i18n from '@/i18n.ts';

/**
 * A completion date, said the way it is actually known.
 *
 * The month and the year, never the day. That date came out of dividing what is left by a monthly
 * pace, so "ready by 14 September" claims a precision the arithmetic does not have — and a person
 * reading it would plan around a day that means nothing.
 */
export const formatMonthAndYear = (date: Date): string =>
  `${formatMonth(date.getMonth())} ${date.getFullYear()}`;

/**
 * Months of cover, to one decimal, in the reader's own notation.
 *
 * One decimal because the figure moves with the cost of living and a second digit would suggest
 * the app knows the month's cost to the penny. In the reader's notation because "4.2" beside
 * "10 428,00 zł" is two number systems in one sentence.
 */
export const formatCoverage = (months: number): string =>
  new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(months);
