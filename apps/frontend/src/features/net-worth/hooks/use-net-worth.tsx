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
import { changeSincePrevious } from '@/features/net-worth/services/valuation-history.service.ts';
import { currencyExposure } from '@/features/net-worth/services/currency-exposure.service.ts';
import { allocation } from '@/features/net-worth/services/allocation.service.ts';
import { growthSeries } from '@/features/net-worth/services/growth-series.service.ts';
import { ASSET_TYPE } from '@/constant.ts';
import { paidInAndGrown } from '@/features/net-worth/services/paid-in-and-grown.service.ts';
import { useGoalRecords } from '@/features/goals/hooks/use-goal-records.tsx';
import { freeValue, type BackableHolding } from '@/features/goals/services/goal-backing.service.ts';

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
  const valuations = useLiveQuery(() => db.valuations.toArray(), []) || [];

  // The declarations, already in the currency this screen reads — from the one place that joins a
  // goal's currency onto them, so this screen and the goals screen cannot disagree about what was
  // put aside. Handing over one side converted and the other not would report a difference that is
  // mostly the exchange rate.
  const { contributions: declared } = useGoalRecords();

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

  // What each holding has done since anybody last valued it, converted at the rate of its latest
  // reading — the same rate for both figures behind it, so what the reader sees is the holding
  // moving and never the rate moving underneath it.
  const changes = convertDataToDesiredCurrency({
    data: positions
      .map((position) => changeSincePrevious(position.id, valuations))
      .filter((change) => change !== undefined),
    exchangeRates,
    desiredCurrency: settings?.currency,
    amountKey: 'amount',
    dateKey: 'on',
  });

  const converted = inOneCurrency(positions, 'valuedOn');

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
  // Every asset in one shape, so what went into it can be told from what it earned. The bonds are in
  // it because a goal can read one, and the split is as much a fact about a bond as about an account.
  const assigned = [
    ...converted
      .filter((position) => position.kind === 'asset')
      .map((position) => ({
        id: position.id,
        value: position.value,
        currency: position.currency,
        assignments: position.assignments,
      })),
    ...valuedBonds.map((valued, index) => ({
      id: valued.id,
      value: valued.value,
      currency: valued.currency,
      assignments: bonds[index]?.assignments,
    })),
  ];

  const convertedPositions = converted.map((position) => ({
    ...position,
    change: changes.find((change) => change.positionId === position.id),
    split: paidInAndGrown(position.id, assigned, declared),
  }));

  const holdings: BackableHolding[] = [
    ...convertedPositions
      .filter((position) => position.kind === 'asset')
      .map((position) => ({
        id: position.id,
        description: position.description,
        value: position.value,
        assignments: position.assignments,
        // Carried through so a goal reading this holding can say why its own figure moved.
        change: position.change,
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
    // How much of what is held has not been promised to anything, and nothing at all until
    // something has been. Read off the same holdings the goals read, so the two can never disagree
    // about which złoty is spoken for.
    unassigned: freeValue(holdings),
    // Which currencies the held figure actually sits in — the question one converted number hides.
    // The bonds are in it because they are the plainest case of it: priced in złoty by definition,
    // so anybody reading in euro is exposed through them whether they think about it or not.
    exposure: currencyExposure([
      ...convertedPositions.filter((position) => position.kind === 'asset'),
      ...valuedBonds,
    ]),
    // What the wealth is made of, and how far that is from what was planned. Assets only: an
    // allocation is a breakdown of what you hold, and a mortgage is not a kind of holding.
    allocation: allocation(
      [
        ...converted
          .filter((position) => position.kind === 'asset')
          .map((position) => ({ value: position.value, assetType: position.assetType })),
        // Bonds are bonds, and the app knows it without anybody saying so.
        ...valuedBonds.map((valued) => ({ value: valued.value, assetType: ASSET_TYPE.BONDS })),
      ],
      settings?.allocationTarget ?? {}
    ),
    // How the whole of it has moved, on every day anybody said anything. Every reading converted at
    // **one** rate — today's — because at each reading's own day's rate the line would rise and fall
    // with the exchange rate, and a chart answering "is my wealth growing" would answer "did the
    // złoty move" instead.
    growth: growthSeries(
      convertDataToDesiredCurrency({
        data: valuations,
        exchangeRates,
        desiredCurrency: settings?.currency,
        amountKey: 'value',
      })
    ),
    valuedOn: stalestValuation(convertedPositions),
    // What the two sides are made of, for anything drawing the whole picture rather than the figure.
    breakdown: netWorthBreakdown(convertedPositions, bondValues),
  };
};
