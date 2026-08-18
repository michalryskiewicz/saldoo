import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useSettings } from '@/features/settings/use-settings.ts';
import { useListExchangeRatesQuery } from '@/store/exchange-rates.api.ts';
import { convertDataToDesiredCurrency } from '@/lib/exchange-rate.ts';
import { getEarliestAndLatestDate, toISODate } from '@/lib/dates.ts';
import { DEFAULT_SETTINGS } from '@/database/settings.service.ts';
import { netWorthWithBonds, stalestValuation } from '@/features/net-worth/services/net-worth.service.ts';
import { netWorthBreakdown } from '@/features/net-worth/services/net-worth-breakdown.service.ts';

/**
 * What is held and what is owed, in one currency.
 *
 * Converted at the rate of **the day each position was valued**, not today's. A flat valued in
 * euro last November was worth what it was worth last November; re-pricing the currency without
 * re-pricing the flat would move the figure for a reason that has nothing to do with the flat.
 */
export const useNetWorth = () => {
  const { settings } = useSettings();
  const positions = useLiveQuery(() => db.positions.toArray(), []) || [];
  const bonds = useLiveQuery(() => db.bonds.toArray(), []) || [];

  const { earliest } = getEarliestAndLatestDate(positions, 'valuedOn', 'iso-date');
  const { data: exchangeRates } = useListExchangeRatesQuery(
    { fromDate: earliest as string, toDate: toISODate(new Date()) },
    { skip: !earliest }
  );

  const inOneCurrency = settings?.currency
    ? convertDataToDesiredCurrency({
        data: positions,
        exchangeRates,
        desiredCurrency: settings.currency,
        amountKey: 'value',
        dateKey: 'valuedOn',
      })
    : positions;

  return {
    currency: settings?.currency ?? DEFAULT_SETTINGS.currency,
    positions: inOneCurrency,
    bonds,
    // Bonds at what they are worth today, worked out rather than stated — nobody has to remember
    // to update one.
    totals: netWorthWithBonds(inOneCurrency, bonds, new Date()),
    valuedOn: stalestValuation(inOneCurrency),
    // What the two sides are made of, for anything drawing the whole picture rather than the figure.
    breakdown: netWorthBreakdown(inOneCurrency, bonds, new Date()),
  };
};
