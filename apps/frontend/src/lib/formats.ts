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
/**
 * The same phrase for a cadence that skips some of its units — "co 4 tygodnie, w środę".
 *
 * The weekday is its own key rather than part of the sentence, so each language keeps its own
 * word order around it: Polish declines it after both "co" and "w", English puts it after "on".
 */
const formatInterval = (date: Date, frequency: FREQUENCY, count: number) => {
  const weekday = i18n.t(`recurrence.weekday_${date.getDay()}` as TranslationKey);

  switch (frequency) {
    case FREQUENCY.DAILY:
      return i18n.t('recurrence.every_days' as TranslationKey, { count });
    case FREQUENCY.WEEKLY:
      return i18n.t('recurrence.every_weeks' as TranslationKey, { count, weekday });
    case FREQUENCY.MONTHLY:
      return i18n.t('recurrence.every_months' as TranslationKey, { count, day: format(date, 'd') });
    case FREQUENCY.YEARLY:
      return i18n.t('recurrence.every_years' as TranslationKey, {
        count,
        date: format(date, 'd MMMM', { locale: dateLocale() }),
      });
    default:
      return '';
  }
};

const formatCadence = (date: Date, frequency: FREQUENCY, every?: number) => {
  if (every) return formatInterval(date, frequency, every);

  switch (frequency) {
    case FREQUENCY.WEEKLY:
      return i18n.t(`recurrence.weekly_${date.getDay()}` as TranslationKey);
    case FREQUENCY.MONTHLY:
      // No leading zero: this reads as a sentence, and "05. dnia miesiąca" is not how one is said.
      return i18n.t('recurrence.monthly', { day: format(date, 'd') });
    case FREQUENCY.YEARLY:
      return i18n.t('recurrence.yearly', {
        date: format(date, 'd MMMM', { locale: dateLocale() }),
      });
    default:
      return '';
  }
};

export const formatRecurrence = (
  date: Date | string | undefined,
  frequency?: FREQUENCY,
  interval?: number,
  endsAt?: Date | string
) => {
  // Only an interval worth saying out loud. Every recurrence means "every one" by default, and
  // "co 1 tydzień" is not a phrase anybody says.
  const every = interval && interval > 1 ? interval : undefined;

  const daily = frequency === FREQUENCY.DAILY && !every ? i18n.t('recurrence.daily') : undefined;

  if (!daily && (!frequency || !date)) return '-';

  const cadence = daily ?? formatCadence(new Date(date!), frequency!, every);

  if (!endsAt) return cadence;

  // A series that has stopped otherwise reads exactly like a live one while costing nothing a
  // year, which looks like a defect rather than an answer.
  return i18n.t('recurrence.until', {
    recurrence: cadence,
    date: format(new Date(endsAt), 'd MMM yyyy', { locale: dateLocale() }),
  });
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

/**
 * An interest rate the way the Ministry prints it — "5,35%", two places and a comma.
 *
 * Not a template literal around the number: that yields "5.35%" in a Polish interface, which reads
 * as somebody's typo rather than as a rate.
 */
export const formatPercent = (value: number, locale: string = i18n.language) =>
  `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;

/**
 * A `YYYY-MM` month as somebody says it out loud — "Sierpień 2026".
 *
 * Split by hand rather than handed to `new Date(iso)`: a bare `2026-08` is read as UTC midnight, so
 * anybody west of Greenwich would be offered July.
 */
export const formatMonthAndYear = (month: string, locale: string = i18n.language) => {
  const [year, index] = month.split('-').map(Number);

  return capitalize(
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      new Date(year, index - 1, 1)
    )
  );
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
/**
 * Money for an axis: whole units, no grosze.
 *
 * An axis is read by glancing at it, and "26 000,00 zł" spends five of its characters on a
 * fraction nobody is looking for at that scale — while making the labels wide enough to crowd the
 * plot they are supposed to describe. The tooltip is where exact figures belong.
 */
export const formatAxisMoney = (
  amount: number,
  currency: string,
  locale: string = i18n.language
): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

export const formatMoneyValue = (value: unknown, currency: string | undefined): string => {
  const amount = Number(Array.isArray(value) ? value[0] : value);

  if (!Number.isFinite(amount)) return '';

  return currency ? formatMoney(amount, currency) : formatNumber(amount);
};

/**
 * When an occurrence falls due, written the way a person says it.
 *
 * The year is only spelled out when it is not the one being read: "4 lip" for this year and
 * "4 sty 2027" for the next. A year on every row would be four characters of noise on the
 * column that has to be scannable, since scanning it is the whole reason it exists.
 *
 * `today` is a parameter rather than a call to the clock, so the column can be tested without
 * the answer changing on New Year's Eve.
 */
export const formatDueDate = (date: Date | string, today: Date) => {
  const due = new Date(date);
  const sameYear = due.getFullYear() === today.getFullYear();

  return format(due, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: dateLocale() });
};
