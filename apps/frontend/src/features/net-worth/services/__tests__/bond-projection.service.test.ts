import { describe, expect, it } from 'vitest';
import type { DBBondHolding } from '@/database/bonds.ts';
import { bondSeries, holdingsInCurrency } from '../bond-projection.service.ts';

const bought = (fields: Partial<DBBondHolding> = {}): DBBondHolding =>
  ({
    id: 'b1',
    description: 'EDO0335',
    quantity: 100,
    nominal: 100,
    boughtOn: new Date(2025, 2, 10),
    ratePercent: 6.55,
    interest: 'compounds',
    period: 'yearly',
    currency: 'PLN',
    ...fields,
  }) as DBBondHolding;

const TODAY = new Date(2026, 5, 15);

describe('holdingsInCurrency', () => {
  /**
   * A projection cannot be converted. Today's holdings could be, at today's rate — but a figure
   * five years out would need an exchange rate five years out, and inventing one would put a
   * confident number about somebody's money on the screen. So the odd-currency holding is left
   * out and counted, and the chart says how many it left out.
   */
  it('keeps what is in the display currency and counts what it left out', () => {
    const { included, excluded } = holdingsInCurrency(
      [bought(), bought({ id: 'b2', currency: 'EUR' }), bought({ id: 'b3' })],
      'PLN'
    );

    expect(included.map((holding) => holding.id)).toEqual(['b1', 'b3']);
    expect(excluded).toBe(1);
  });
});

describe('bondSeries', () => {
  it('is empty when nothing is held, rather than a flat line at zero', () => {
    expect(bondSeries([], { today: TODAY, years: 10 })).toEqual([]);
  });

  it('starts on the month of the earliest purchase and runs the whole horizon', () => {
    const series = bondSeries([bought()], { today: TODAY, years: 10 });

    expect(series.at(0)!.on).toEqual(new Date(2025, 2, 1));
    // Fifteen months of history, then ten years ahead, both ends included.
    expect(series.at(-1)!.on).toEqual(new Date(2036, 5, 1));
    expect(series).toHaveLength(15 + 120 + 1);
  });

  it('carries capital from the first month and no interest yet', () => {
    const [first] = bondSeries([bought()], { today: TODAY, years: 10 });

    expect(first).toEqual({ on: new Date(2025, 2, 1), capital: 10000, interest: 0, projected: false });
  });

  /**
   * The projection is the same arithmetic as the history — `bondValueOn` of a future day — so
   * there is no second formula to keep in step. What changes is only that the app says so.
   */
  it('marks every point after today as projected, and nothing before it', () => {
    const series = bondSeries([bought()], { today: TODAY, years: 10 });
    const past = series.filter((point) => !point.projected);

    expect(past.at(-1)!.on).toEqual(new Date(2026, 5, 1));
    expect(series[past.length].projected).toBe(true);
  });

  it('grows the interest at each period end and holds it flat between them', () => {
    const series = bondSeries([bought()], { today: TODAY, years: 10 });
    const at = (year: number, month: number) =>
      series.find((point) => point.on.getFullYear() === year && point.on.getMonth() === month)!;

    // Bought in March 2025, so the first year is not up until March 2026.
    expect(at(2026, 1).interest).toBe(0);
    expect(at(2026, 2).interest).toBe(655);
    expect(at(2026, 3).interest).toBe(655);
    expect(at(2027, 2).interest).toBe(1352.9);
  });

  /**
   * The chart answers what these bonds have produced, so interest that left for the person's
   * account counts here — it is money the bond earned. It is *not* what the holding is worth,
   * which is why net worth counts the two differently and the chart says so in words.
   */
  it('counts interest a paying bond sent to the account as interest earned', () => {
    const series = bondSeries([bought({ interest: 'pays out' })], { today: TODAY, years: 10 });
    const afterTwoYears = series.find(
      (point) => point.on.getFullYear() === 2027 && point.on.getMonth() === 2
    )!;

    expect(afterTwoYears.capital).toBe(10000);
    expect(afterTwoYears.interest).toBe(1310);
  });

  it('adds several holdings together at every point, including one bought later', () => {
    const series = bondSeries(
      [bought(), bought({ id: 'b2', boughtOn: new Date(2026, 0, 10), quantity: 50 })],
      { today: TODAY, years: 10 }
    );
    const at = (year: number, month: number) =>
      series.find((point) => point.on.getFullYear() === year && point.on.getMonth() === month)!;

    // Before the second purchase only the first is held.
    expect(at(2025, 11).capital).toBe(10000);
    expect(at(2026, 0).capital).toBe(15000);
    // March 2026: the first bond's year is up, the second's is not.
    expect(at(2026, 2).interest).toBe(655);
  });
});
