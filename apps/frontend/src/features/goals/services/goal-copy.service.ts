import { formatMonth } from '@/lib/formats.ts';

/**
 * A completion date, said the way it is actually known.
 *
 * The month and the year, never the day. That date came out of dividing what is left by a monthly
 * pace, so "ready by 14 September" claims a precision the arithmetic does not have — and a person
 * reading it would plan around a day that means nothing.
 */
export const formatMonthAndYear = (date: Date): string =>
  `${formatMonth(date.getMonth())} ${date.getFullYear()}`;
