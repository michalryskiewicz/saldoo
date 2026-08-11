import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useSettings } from '@/features/settings/use-settings.ts';
import { DEFAULT_SETTINGS } from '@/database/settings.service.ts';
import { differenceInCalendarMonths } from 'date-fns';
import {
  bondSeries,
  holdingsToChart,
} from '@/features/net-worth/services/bond-projection.service.ts';
import { lastMaturity, maturityOf } from '@/features/net-worth/services/bond-maturity.service.ts';

/** Where the horizon control starts: far enough to be useful, short enough to read. */
export const DEFAULT_HORIZON_YEARS = 10;

export type BondChartRow = {
  /** `YYYY-MM`, so the axis can tick once a year without a second date library. */
  label: string;
  capital: number;
  interest: number;
  /** What the holdings are worth on that day — the line that climbs on its own. */
  worth: number;
  /** The same day, after the tax each holding's wrapper would charge on the way out. */
  net: number;
};

/**
 * The bond chart's data, in one currency, out to a horizon the reader chooses.
 *
 * The horizon used to be fixed at ten years on the argument that nobody would want it otherwise.
 * They do: the question a holder actually asks is *when does this come back and what is it worth
 * then*, and answering it means being able to reach the redemption of the longest thing held and
 * to pull the whole guess away again to see only what is known.
 */
export const useBondSeries = (years: number = DEFAULT_HORIZON_YEARS) => {
  const { settings } = useSettings();
  const bonds = useLiveQuery(() => db.bonds.toArray(), []) || [];

  const { currency, included, excluded } = holdingsToChart(bonds);
  const today = new Date();

  const last = lastMaturity(included);
  const yearsToLastMaturity = last
    ? Math.max(0, Math.ceil(differenceInCalendarMonths(last, today) / 12))
    : 0;

  // Capped at the furthest redemption: past it every holding has been paid back and the chart would
  // be drawing a flat line about money that is no longer in a bond.
  const series = bondSeries(included, { today, years: Math.min(years, yearsToLastMaturity) });

  const rows: BondChartRow[] = series.map(({ on, capital, interest, worth, net }) => ({
    label: `${on.getFullYear()}-${String(on.getMonth() + 1).padStart(2, '0')}`,
    capital,
    interest,
    worth,
    net,
  }));

  return {
    rows,
    // The bonds' own currency, so the axis says what the numbers are in rather than what the rest
    // of the app happens to be printed in.
    currency: currency ?? settings?.currency ?? DEFAULT_SETTINGS.currency,
    excluded,
    /** How the holdings split across tax treatments, so the chart can say what it is applying. */
    wrappers: {
      none: included.filter((bond) => !bond.wrapper || bond.wrapper === 'none').length,
      IKE: included.filter((bond) => bond.wrapper === 'IKE').length,
      IKZE: included.filter((bond) => bond.wrapper === 'IKZE').length,
    },
    /**
     * Years from today to the furthest redemption, so the control offers exactly the span that has
     * something in it rather than an arbitrary decade.
     */
    yearsToLastMaturity,
    /**
     * Every redemption inside the drawn span, one entry per month.
     *
     * Gathered by month rather than by holding: two bonds coming back in the same one drew two
     * markers on the same pixel and printed their names into each other — "EDO0136EDO0836" — which
     * is how a helpful label becomes a smudge.
     */
    maturities: [
      ...included
        .map((bond) => ({ bond, on: maturityOf(bond) }))
        .filter((one): one is { bond: (typeof included)[number]; on: Date } => Boolean(one.on))
        .reduce((byMonth, { bond, on }) => {
          const label = `${on.getFullYear()}-${String(on.getMonth() + 1).padStart(2, '0')}`;
          const names = byMonth.get(label) ?? [];

          return byMonth.set(label, [...names, bond.description]);
        }, new Map<string, string[]>()),
    ].map(([label, names]) => ({ label, name: names.join(' · ') })),
    /** Where the drawn history stops and the same arithmetic starts describing a day that has not come. */
    projectionFrom: rows[series.findIndex((point) => point.projected)]?.label,
  };
};
