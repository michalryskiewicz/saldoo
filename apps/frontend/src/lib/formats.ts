import { format } from 'date-fns';
import { CONFIG } from '@/global-config.ts';
import { enUS, pl } from 'date-fns/locale';
import i18n, { type Locale, type TranslationKey } from '@/i18n.ts';
import { capitalize } from '@/lib/strings.ts';
import { FREQUENCY } from '@/constant';

/** The date library's locale, following the one the app is running in. */
const dateLocale = () => (i18n.language === 'en' ? enUS : pl);

/**
 * How often a cost recurs and when, as one phrase.
 *
 * This replaces two columns that said the same thing twice: "15. dnia miesiąca" already means
 * monthly, and reading "15. dnia miesiąca · Miesięczna" across a row is the same fact answered
 * twice. One phrase carries both — "codziennie", "co piątek", "15. dnia miesiąca", "co roku,
 * 15 lipca" — and each is unambiguous on its own.
 *
 * The weekday comes from the translations rather than from the date library, and it has to:
 * Polish declines it after "co". `date-fns` gives the nominative ("środa", "sobota") where the
 * phrase needs the accusative ("co środę", "co sobotę"), and no formatting option produces that.
 * Seven keys per locale is the honest price of a phrase that reads correctly.
 */
export const formatRecurrence = (date: Date | string | undefined, frequency?: FREQUENCY) => {
  if (frequency === FREQUENCY.DAILY) {
    return i18n.t('recurrence.daily');
  }

  if (!frequency || !date) {
    return '-';
  }

  const d = new Date(date);

  switch (frequency) {
    case FREQUENCY.WEEKLY:
      return i18n.t(`recurrence.weekly_${d.getDay()}` as TranslationKey);
    case FREQUENCY.MONTHLY:
      // No leading zero: this reads as a sentence, and "05. dnia miesiąca" is not how one is said.
      return i18n.t('recurrence.monthly', { day: format(d, 'd') });
    case FREQUENCY.YEARLY:
      return i18n.t('recurrence.yearly', { date: format(d, 'd MMMM', { locale: dateLocale() }) });
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

/**
 * A figure handed over by a chart, as money.
 *
 * Every tooltip in the app used to build this itself — the raw number beside the raw currency
 * *code* — so a chart said "3093.48 EUR" while the table beside it said "3 093,48 €". Same money,
 * same screen, two notations, and neither of them the one the app had chosen.
 *
 * Two things it has to absorb, which is why it exists rather than being an inline `formatMoney`:
 * Recharts types a tooltip value loosely (it may be a string, or an array for a stacked series),
 * and the currency comes from settings that may not have loaded yet. Without a currency there is
 * no honest symbol to show, so the bare number is what is left.
 */
export const formatMoneyValue = (value: unknown, currency: string | undefined): string => {
  const amount = Number(Array.isArray(value) ? value[0] : value);

  if (!Number.isFinite(amount)) return '';

  return currency ? formatMoney(amount, currency) : formatNumber(amount);
};
