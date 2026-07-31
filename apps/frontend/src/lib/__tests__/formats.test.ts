import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyValue, formatRecurrence } from '../formats.ts';
import { FREQUENCY } from '@/constant.ts';

describe('formatMoney', () => {
  it('formats in Polish regardless of the machine it runs on', () => {
    // The app speaks Polish and the currency comes from the user's settings, so neither may
    // depend on the browser's locale. Left to `Intl`'s default, the same figure rendered as
    // "12 500,00 zł" in a table and "PLN 12,500.00" on a card, and which one a person saw was
    // decided by their operating system.
    const formatted = formatMoney(12500, 'PLN');

    expect(formatted).toContain('12');
    expect(formatted).toContain('500');
    // Polish writes the decimal separator as a comma and the symbol after the number.
    expect(formatted).toMatch(/,\d\d/);
    expect(formatted).toMatch(/zł\s*$/);
  });

  it('agrees with itself whether or not a locale is passed', () => {
    expect(formatMoney(12500, 'PLN')).toBe(formatMoney(12500, 'PLN', 'pl'));
  });

  it('still honours an explicit locale, for anywhere that genuinely needs one', () => {
    expect(formatMoney(12500, 'EUR', 'en-US')).toContain('€');
  });

  it('keeps two decimals, so a column of figures lines up', () => {
    expect(formatMoney(7, 'PLN')).toMatch(/7,00/);
  });
});

describe('formatMoneyValue', () => {
  it('renders a symbol, not a currency code', () => {
    // The complaint: a chart said "3093.48 EUR" where the table beside it said "€".
    const formatted = formatMoneyValue(3093.48, 'EUR');

    expect(formatted).toContain('€');
    expect(formatted).not.toContain('EUR');
  });

  it('formats the way the rest of the app does', () => {
    expect(formatMoneyValue(2500, 'PLN')).toBe(formatMoney(2500, 'PLN'));
  });

  it('takes the string a chart hands it', () => {
    expect(formatMoneyValue('2500', 'PLN')).toBe(formatMoney(2500, 'PLN'));
  });

  it('takes the first entry of a stacked series', () => {
    expect(formatMoneyValue([2500, 400], 'PLN')).toBe(formatMoney(2500, 'PLN'));
  });

  it('falls back to a bare number before the currency has loaded', () => {
    // There is no honest symbol to show yet, and guessing one would be worse than none.
    expect(formatMoneyValue(2500, undefined)).toBe('2500.00');
  });

  it('says nothing when there is no number', () => {
    expect(formatMoneyValue(undefined, 'PLN')).toBe('');
    expect(formatMoneyValue('nie liczba', 'PLN')).toBe('');
  });
});

describe('formatRecurrence', () => {
  // 15 July 2026 was a Wednesday.
  const wednesday = new Date('2026-07-15T00:00:00');
  const saturday = new Date('2026-07-18T00:00:00');

  it('answers a daily cost with words rather than a dash', () => {
    // A dash is what a table prints when it has nothing to say, and "every day" is not nothing.
    expect(formatRecurrence(wednesday, FREQUENCY.DAILY)).toBe('codziennie');
  });

  it('says how often and when in one phrase, so two columns are not needed', () => {
    // This is the whole reason the function exists: each answer carries the frequency *and* the
    // timing, where "15. dnia miesiąca" beside "Miesięczna" said one of them twice.
    expect(formatRecurrence(wednesday, FREQUENCY.MONTHLY)).toBe('15. dnia miesiąca');
    expect(formatRecurrence(wednesday, FREQUENCY.YEARLY)).toBe('co roku, 15 lipca');
  });

  it('declines the weekday, which no date format does', () => {
    // `date-fns` gives "środa" and "sobota"; the phrase needs the accusative.
    expect(formatRecurrence(wednesday, FREQUENCY.WEEKLY)).toBe('co środę');
    expect(formatRecurrence(saturday, FREQUENCY.WEEKLY)).toBe('co sobotę');
  });

  it('drops the leading zero, because the phrase is read aloud', () => {
    expect(formatRecurrence(new Date('2026-07-05T00:00:00'), FREQUENCY.MONTHLY)).toBe(
      '5. dnia miesiąca'
    );
  });

  it('needs no date to know a daily cost recurs daily', () => {
    expect(formatRecurrence(undefined, FREQUENCY.DAILY)).toBe('codziennie');
  });

  it('falls back to a dash when there is genuinely nothing to say', () => {
    expect(formatRecurrence(undefined, FREQUENCY.MONTHLY)).toBe('-');
    expect(formatRecurrence(wednesday, undefined)).toBe('-');
  });
});
