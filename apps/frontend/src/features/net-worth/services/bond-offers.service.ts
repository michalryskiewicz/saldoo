import {
  rateFor,
  seriesOfferedIn,
  BOND_SERIES,
  type BondSeriesCode,
  type BondSeriesSpec,
  type OfferMonth,
} from '@/features/net-worth/services/bond-catalogue.service.ts';

/** One row as the backend keeps it: what it read off the Ministry's page, and when. */
export type BondOfferDTO = {
  series: string;
  month: string;
  ratePercent: number;
};

/** What was fetched, by series and month. */
export type FetchedRates = Partial<Record<BondSeriesCode, Record<OfferMonth, number>>>;

const MODELLED = new Set<string>(BOND_SERIES.map((series) => series.code));

/**
 * Turns what the backend sent into something to look a rate up in.
 *
 * A series this app does not model is dropped rather than carried: OTS is sold and is deliberately
 * absent from the arithmetic, so a rate for it would be a row nothing can use.
 */
export const fetchedRates = (offers: BondOfferDTO[] | undefined): FetchedRates =>
  (offers ?? [])
    .filter((offer) => MODELLED.has(offer.series))
    .reduce<FetchedRates>((rates, offer) => {
      const code = offer.series as BondSeriesCode;

      return { ...rates, [code]: { ...rates[code], [offer.month]: offer.ratePercent } };
    }, {});

/**
 * The rate, preferring what was fetched over what was shipped.
 *
 * **Fetched wins where both know a month.** The catalogue in the bundle is one reading, taken once;
 * the backend re-reads the same pages every week, so where they disagree the fresher one is the one
 * to trust — and a correction upstream reaches somebody without waiting for a release.
 *
 * **The bundle is the floor.** Offline, on a dead backend, and on the very first render before the
 * query has answered, this is exactly the catalogue the app has always had. Nothing about entering
 * a bond depends on a server being up.
 */
export const rateFrom = (
  fetched: FetchedRates,
  code: BondSeriesCode,
  month: OfferMonth
): number | undefined => fetched[code]?.[month] ?? rateFor(code, month);

/** What could be bought that month, counting anything the backend has since read. */
export const seriesOfferedFrom = (
  fetched: FetchedRates,
  month: OfferMonth
): BondSeriesSpec[] => {
  const shipped = seriesOfferedIn(month);
  if (shipped.length > 0) return shipped;

  return BOND_SERIES.filter((series) => fetched[series.code]?.[month] !== undefined);
};

/** Every month that can be priced now — the shipped span plus anything fetched since. */
export const monthsPriceableFrom = (fetched: FetchedRates, shipped: OfferMonth[]): OfferMonth[] => {
  const extra = Object.values(fetched)
    .flatMap((byMonth) => Object.keys(byMonth ?? {}))
    .filter((month) => !shipped.includes(month));

  return [...new Set([...shipped, ...extra])].sort();
};
