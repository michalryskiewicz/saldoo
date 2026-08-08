import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useSettings } from '@/features/settings/use-settings.ts';
import { DEFAULT_SETTINGS } from '@/database/settings.service.ts';
import {
  bondSeries,
  holdingsToChart,
} from '@/features/net-worth/services/bond-projection.service.ts';

/** Ten years, which is how long an EDO runs and the longest anything retail here does. */
const HORIZON_YEARS = 10;

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
 * The bond chart's data, in one currency.
 *
 * The horizon is fixed rather than asked for: a bond bought today is a ten-year decision, and
 * offering a control for it would be offering a choice nobody has a reason to make differently.
 */
export const useBondSeries = () => {
  const { settings } = useSettings();
  const bonds = useLiveQuery(() => db.bonds.toArray(), []) || [];

  const { currency, included, excluded } = holdingsToChart(bonds);
  const series = bondSeries(included, { today: new Date(), years: HORIZON_YEARS });

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
    /** Whether any holding sits in a wrapper, which is what makes the net line worth a switch. */
    hasWrappers: included.some((bond) => bond.wrapper && bond.wrapper !== 'none'),
    /** Where the drawn history stops and the same arithmetic starts describing a day that has not come. */
    projectionFrom: rows[series.findIndex((point) => point.projected)]?.label,
  };
};
