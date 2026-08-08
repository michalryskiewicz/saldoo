import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useSettings } from '@/features/settings/use-settings.ts';
import { useListExchangeRatesQuery } from '@/store/exchange-rates.api.ts';
import { convertDataToDesiredCurrency } from '@/lib/exchange-rate.ts';
import { getEarliestAndLatestDate, toISODate } from '@/lib/dates.ts';
import { DEFAULT_SETTINGS } from '@/database/settings.service.ts';
import { netWorthWithBonds, stalestValuation } from '@/features/net-worth/services/net-worth.service.ts';
import { netWorthBreakdown } from '@/features/net-worth/services/net-worth-breakdown.service.ts';
import { valueBondsOn } from '@/features/net-worth/services/bond-accrual.service.ts';
import type { BackableHolding } from '@/features/goals/services/goal-backing.service.ts';

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

  const today = new Date();

  // The window has to reach today even on an account whose only holdings are bonds: those are
  // priced for today, and without today's rate there is nothing to convert them at.
  const { earliest } = getEarliestAndLatestDate(positions, 'valuedOn', 'iso-date');
  const { data: exchangeRates } = useListExchangeRatesQuery(
    { fromDate: (earliest as string) ?? toISODate(today), toDate: toISODate(today) },
    { skip: !positions.length && !bonds.length }
  );

  const inOneCurrency = <T,>(data: T[], dateKey: string): T[] =>
    settings?.currency
      ? (convertDataToDesiredCurrency({
          data: data as never,
          exchangeRates,
          desiredCurrency: settings.currency,
          amountKey: 'value',
          dateKey,
        }) as T[])
      : data;

  const convertedPositions = inOneCurrency(positions, 'valuedOn');

  // Valued first, converted second, added last. A bond's worth follows from its own currency's
  // nominal and rate, so it cannot be converted until something has priced it — and it has to be
  // converted before it joins a total printed in another currency, which is what used to be
  // missing: a złoty bond went into a euro net worth at its face figure.
  const valuedBonds = inOneCurrency(valueBondsOn(bonds, today), 'valuedOn');
  const bondValues = valuedBonds.map((bond) => bond.value);

  // Everything held, in one currency and one shape, for anything that asks what stands behind a
  // goal. Positions keep their own valuation date; a bond is priced for today and converted at
  // today's rate, which is why the two can only be joined after both have been through the
  // converter and never before.
  const holdings: BackableHolding[] = [
    ...convertedPositions
      .filter((position) => position.kind === 'asset')
      .map((position) => ({
        id: position.id,
        description: position.description,
        value: position.value,
        assignments: position.assignments,
      })),
    ...valuedBonds.map((valued, index) => ({
      id: valued.id,
      description: bonds[index]?.description ?? valued.id,
      value: valued.value,
      assignments: bonds[index]?.assignments,
    })),
  ];

  return {
    currency: settings?.currency ?? DEFAULT_SETTINGS.currency,
    positions: convertedPositions,
    bonds,
    holdings,
    totals: netWorthWithBonds(convertedPositions, bondValues),
    valuedOn: stalestValuation(convertedPositions),
    // What the two sides are made of, for anything drawing the whole picture rather than the figure.
    breakdown: netWorthBreakdown(convertedPositions, bondValues),
  };
};
