import { format } from 'date-fns';
import { CONFIG } from '@/global-config.ts';
import { pl } from 'date-fns/locale';
import i18n, { type Locale } from '@/i18n.ts';
import { capitalize } from '@/lib/strings.ts';
import { FREQUENCY } from '@/constant';

export const formatFrequency = (date: Date | string | undefined, frequency?: FREQUENCY) => {
  if (frequency === FREQUENCY.DAILY || !frequency || !date) {
    return '-';
  }
  const d = new Date(date);
  switch (frequency) {
    case FREQUENCY.WEEKLY:
      return format(d, 'EEEE', { locale: pl }); // e.g. Monday
    case FREQUENCY.MONTHLY:
      return format(d, 'dd'); // e.g. 01, 28
    case FREQUENCY.YEARLY:
      return format(d, 'dd MMMM', { locale: pl }); // e.g. 28 Lipca
    default:
      return '';
  }
};

type MonthIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type FormatMonthOptions = {
  type?: 'short' | 'long';
  locale?: Locale;
};

type FormatDayOptions = {
  type?: 'short' | 'long';
  locale?: string;
};

export const formatMonth = (
  monthIndex: MonthIndex | number | string,
  options: FormatMonthOptions = { type: 'long', locale: 'pl' }
) => {
  if (typeof monthIndex === 'string') {
    return capitalize(monthIndex);
  }
  // Create a date with the given month index (1st day of that month)
  const date = new Date(2000, monthIndex, 1);
  return capitalize(new Intl.DateTimeFormat(options.locale, { month: options.type }).format(date));
};

export const formatDay = (
  dayIndex: DayIndex | number | string,
  options: FormatDayOptions = { type: 'long', locale: 'pl' }
) => {
  if (typeof dayIndex === 'string') {
    return capitalize(dayIndex);
  }
  // Create a date with the given day index (using 2000-01-02 as Sunday)
  const date = new Date(2000, 0, 2 + dayIndex);
  return capitalize(
    new Intl.DateTimeFormat(options.locale, { weekday: options.type }).format(date)
  );
};

export const formatDate = (date: Date | string) => {
  return format(new Date(date), CONFIG.dateFormat);
};

/**
 * Money, in the language the app is speaking.
 *
 * The locale defaults to the app's rather than to `Intl`'s, which is the browser's. Left to
 * that default the same figure came out "12 500,00 zł" in a table and "PLN 12,500.00" on a
 * card — and which one a person saw was decided by their operating system, not by anything
 * this app chose.
 */
export const formatMoney = (amount: number, currency: string, locale: string = i18n.language) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const formatNumber = (value: number | string) => {
  return Number(value).toFixed(2);
};
