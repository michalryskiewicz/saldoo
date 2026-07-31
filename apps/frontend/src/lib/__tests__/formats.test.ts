import { describe, expect, it } from 'vitest';
import { formatMoney } from '../formats.ts';

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
