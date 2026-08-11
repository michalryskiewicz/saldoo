import { describe, expect, it } from 'vitest';
import { fetchedRates, rateFrom, seriesOfferedFrom } from '../bond-offers.service.ts';
import { rateFor, seriesOfferedIn } from '../bond-catalogue.service.ts';

const offer = (series: string, month: string, ratePercent: number) => ({
  series,
  month,
  ratePercent,
});

describe('fetchedRates', () => {
  it('keys what the backend sent by series and month', () => {
    const rates = fetchedRates([offer('EDO', '2026-09', 5.35), offer('COI', '2026-09', 4.75)]);

    expect(rates.EDO?.['2026-09']).toBe(5.35);
    expect(rates.COI?.['2026-09']).toBe(4.75);
  });

  it('ignores a series this app does not model', () => {
    // OTS is sold and is not here: its three-month period is neither of the two the arithmetic
    // counts, so a rate for it would be a row nothing can use.
    const rates = fetchedRates([offer('OTS', '2026-09', 2)]);

    expect(rates).toEqual({});
  });

  it('is empty for nothing at all, which is what offline looks like', () => {
    expect(fetchedRates(undefined)).toEqual({});
    expect(fetchedRates([])).toEqual({});
  });
});

describe('rateFrom', () => {
  /**
   * The point of the whole exercise: a month past the end of the shipped catalogue, answered
   * because the backend read it off the Ministry's page rather than because somebody remembered to
   * add a line.
   */
  it('answers for a month the shipped catalogue has never heard of', () => {
    expect(rateFor('EDO', '2026-09')).toBeUndefined();

    expect(rateFrom(fetchedRates([offer('EDO', '2026-09', 5.35)]), 'EDO', '2026-09')).toBe(5.35);
  });

  /**
   * What was fetched wins where both know a month. The catalogue in the bundle is a snapshot of
   * what was read once; the backend re-reads the same pages weekly, so if they disagree the fresher
   * reading is the one to trust — and a correction upstream reaches the app without a release.
   */
  it('prefers what was fetched over what was shipped', () => {
    expect(rateFor('EDO', '2026-08')).toBe(5.35);

    expect(rateFrom(fetchedRates([offer('EDO', '2026-08', 5.4)]), 'EDO', '2026-08')).toBe(5.4);
  });

  /**
   * And falls all the way back to the bundle, which is what keeps the app whole offline, on a
   * dead backend, and on the very first load before the query has answered.
   */
  it('falls back to the shipped catalogue when nothing was fetched', () => {
    expect(rateFrom({}, 'EDO', '2025-04')).toBe(6.55);
    expect(rateFrom({}, 'EDO', '2026-09')).toBeUndefined();
  });
});

describe('seriesOfferedFrom', () => {
  it('adds a month the backend knows to the list of months that can be priced', () => {
    expect(seriesOfferedIn('2026-09')).toEqual([]);

    const offered = seriesOfferedFrom(
      fetchedRates([offer('EDO', '2026-09', 5.35), offer('COI', '2026-09', 4.75)]),
      '2026-09'
    );

    // In the Ministry's own order, shortest first, exactly as the shipped catalogue lists them.
    expect(offered.map((series) => series.code)).toEqual(['COI', 'EDO']);
  });

  it('still knows what was on sale in a month only the bundle covers', () => {
    expect(seriesOfferedFrom({}, '2019-03').map((series) => series.code)).toEqual([
      'COI',
      'ROS',
      'EDO',
      'ROD',
    ]);
  });
});
