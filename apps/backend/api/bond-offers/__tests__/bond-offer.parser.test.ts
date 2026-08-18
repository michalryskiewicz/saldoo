import { describe, expect, it } from 'vitest';
import { parseIssuePage } from '../bond-offer.parser.ts';

/**
 * The wordings the Ministry's issue pages actually use, quoted from live pages rather than
 * imagined — including the markup they sit in.
 *
 * The first version of this parser was written against hand-typed fixtures and passed. Against the
 * real pages it read six series out of seven and found neither the price nor the sale period on any
 * of them: the figures live in their own elements, and TOS words its rate differently because it is
 * the one series with a rate fixed for the whole term. Both mistakes are pinned here.
 */
const EDO = `
  <div><strong>Seria:</strong> EDO0836</div>
  <p><strong>Oprocentowanie:</strong> 5,35% w pierwszym rocznym okresie odsetkowym, w kolejnych
  rocznych okresach odsetkowych: <span>marża 2,00%</span> + inflacja</p>
  <p><strong>Sprzedaż:</strong> 01.08.2026 - 31.08.2026</p>
  <p><strong>Cena sprzedaży jednej obligacji:</strong> 100,00 zł</p>
  <p><strong>Cena zamiany jednej obligacji:</strong> 99,90 zł</p>
`;

/** The three-year, whose rate is fixed for the whole term and never names a first period. */
const TOS = `
  <div><strong>Seria:</strong> TOS0829</div>
  <p><strong>Oprocentowanie:</strong> 4,40%, stałe przez cały 3-letni okres oszczędzania</p>
  <p><strong>Sprzedaż:</strong> 01.08.2026 - 31.08.2026</p>
  <p><strong>Cena sprzedaży jednej obligacji:</strong> 100,00 zł</p>
`;

/** The one-year, which pays monthly and puts "w skali roku" between the figure and the period. */
const ROR = `
  <p><strong>Oprocentowanie:</strong> 4,00% w skali roku, w pierwszym miesięcznym okresie
  odsetkowym.</p>
  <p><strong>Sprzedaż:</strong> 01.08.2026 - 31.08.2026</p>
  <p><strong>Cena sprzedaży jednej obligacji:</strong> 100,00 zł</p>
`;

describe('parseIssuePage', () => {
  it('reads the first-period rate however the sentence is put', () => {
    expect(parseIssuePage(EDO)?.ratePercent).toBe(5.35);
    expect(parseIssuePage(ROR)?.ratePercent).toBe(4);
    expect(parseIssuePage(TOS)?.ratePercent).toBe(4.4);
  });

  /**
   * The margin of later periods, which is the number that says what the rate becomes once the first
   * period is over. A fixed-rate series has none, and inventing a zero would read as a promise.
   */
  it('reads the margin where the issue has one', () => {
    expect(parseIssuePage(EDO)?.marginPercent).toBe(2);
    expect(parseIssuePage(TOS)?.marginPercent).toBeUndefined();
  });

  /**
   * Past the label and past the markup. The price of one bond sits in a sibling element, and the
   * page states a second, different price on the line below — the exchange price — which must not
   * be picked up instead.
   */
  it('reads the price of one bond, not the price of exchanging one', () => {
    expect(parseIssuePage(EDO)?.nominal).toBe(100);
  });

  /**
   * The month it was actually sold in, which is what makes a derived address safe. A guessed URL
   * that answers 200 with some other issue would otherwise be filed under the month we asked for,
   * and a real rate under the wrong month is worse than no rate.
   */
  it('reads the month it was sold in', () => {
    expect(parseIssuePage(EDO)?.soldIn).toBe('2026-08');
    expect(parseIssuePage(TOS)?.soldIn).toBe('2026-08');
  });

  /**
   * Nothing rather than a guess: a redesigned page, a 404 body, or an issue not published yet must
   * all come back as "could not read this", so the caller keeps the last good value.
   */
  it('is nothing at all when the page does not say', () => {
    expect(parseIssuePage('<h1>Nie znaleziono strony</h1>')).toBeUndefined();
    expect(parseIssuePage('')).toBeUndefined();
  });

  it('refuses a rate outside anything a retail bond has ever paid', () => {
    expect(parseIssuePage(EDO.replace('5,35%', '53,50%'))).toBeUndefined();
  });
});
