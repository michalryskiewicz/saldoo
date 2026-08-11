import { describe, expect, it } from 'vitest';
import type { DBBondHolding } from '@/database/bonds.ts';
import { bondSeries, holdingsToChart } from '../bond-projection.service.ts';

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

describe('holdingsToChart', () => {
  /**
   * The bonds' own currency, not the one the rest of the app is printed in. This used to filter by
   * the display currency, so somebody reading their figures in euro with a shelf full of złoty
   * bonds got no chart at all — and no explanation, because the note about what was left out lived
   * inside the card that never rendered.
   */
  it('draws in the currency the bonds are actually in', () => {
    const { currency, included } = holdingsToChart([bought(), bought({ id: 'b2' })]);

    expect(currency).toBe('PLN');
    expect(included.map((holding) => holding.id)).toEqual(['b1', 'b2']);
  });

  /**
   * A projection cannot be converted: a point ten years out would need an exchange rate ten years
   * out. So the larger pile is drawn in its own currency and the rest is counted out loud rather
   * than folded in at a rate nobody can know.
   */
  it('draws the larger pile and counts what that leaves out', () => {
    const { currency, included, excluded } = holdingsToChart([
      bought({ id: 'b1', currency: 'EUR', quantity: 5 }),
      bought({ id: 'b2', quantity: 100 }),
      bought({ id: 'b3', quantity: 20 }),
    ]);

    expect(currency).toBe('PLN');
    expect(included.map((holding) => holding.id)).toEqual(['b2', 'b3']);
    expect(excluded).toBe(1);
  });

  it('has no currency to draw in when nothing is held', () => {
    expect(holdingsToChart([])).toEqual({ currency: undefined, included: [], excluded: 0 });
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

  it('carries capital from the first month, and the days it has already earned', () => {
    const [first] = bondSeries([bought()], { today: TODAY, years: 10 });

    expect(first.on).toEqual(new Date(2025, 2, 1));
    expect(first.capital).toBe(10000);
    // Bought on the 10th and valued at the end of the month: 21 of the year's 365 days, of 655.
    expect(first.interest).toBeCloseTo(37.68, 2);
    expect(first.projected).toBe(false);
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

  /**
   * The shape the chart is drawn for: a line that climbs every month on its own. It used to be a
   * staircase — flat for eleven months, one step at the anniversary — which is not what these bonds
   * do and gave somebody a year of looking at a chart that had not moved.
   */
  it('climbs every month rather than standing still between anniversaries', () => {
    const series = bondSeries([bought()], { today: TODAY, years: 10 });
    const at = (year: number, month: number) =>
      series.find((point) => point.on.getFullYear() === year && point.on.getMonth() === month)!;

    // A month short of the first anniversary: 355 of the year's 365 days of the 655.
    expect(at(2026, 1).interest).toBeCloseTo(637.05, 2);

    const firstYear = [at(2025, 5), at(2025, 8), at(2025, 11), at(2026, 1)].map((p) => p.interest);
    expect(firstYear).toEqual([...firstYear].sort((a, b) => a - b));
    expect(new Set(firstYear).size).toBe(firstYear.length);
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
    // Two years paid into the account, plus the 21 days of the third that nobody has been paid yet
    // — 366 of them in that year, because 2028 is a leap year.
    expect(afterTwoYears.interest).toBeCloseTo(1347.58, 2);
  });

  it('adds several holdings together at every point, including one bought later', () => {
    const series = bondSeries(
      [bought(), bought({ id: 'b2', boughtOn: new Date(2026, 0, 10), quantity: 50 })],
      { today: TODAY, years: 10 }
    );
    const at = (year: number, month: number) =>
      series.find((point) => point.on.getFullYear() === year && point.on.getMonth() === month)!;

    // Before the second purchase only the first is held. The step in the capital line is the
    // purchase itself, which is the one thing on this chart that is not gradual.
    expect(at(2025, 11).capital).toBe(10000);
    expect(at(2026, 0).capital).toBe(15000);
    // End of March 2026: the first bond's year closed on the 10th and has earned 21 days on top of
    // its 655; the second has been accruing on 5 000 since 10 January, 80 days of its first year.
    expect(at(2026, 2).interest).toBeCloseTo(695.15 + 71.78, 1);
  });
});
