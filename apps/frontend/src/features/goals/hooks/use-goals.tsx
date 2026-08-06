import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useSettings } from '@/features/settings/use-settings.ts';
import { useListExchangeRatesQuery } from '@/store/exchange-rates.api.ts';
import { convertDataToDesiredCurrency } from '@/lib/exchange-rate.ts';
import { getEarliestAndLatestDate, toISODate } from '@/lib/dates.ts';
import { goalProgress, totalPutAside } from '@/features/goals/services/goal-progress.service.ts';
import { isEmergencyFund } from '@/database/goals.ts';
import { DEFAULT_SETTINGS } from '@/database/settings.service.ts';

/**
 * Everything the goals screen draws, in one currency.
 *
 * A contribution carries no currency of its own — it is the goal's — so the goal's is joined on
 * before conversion, and conversion is asked for the rate of **the day the money went in**. What
 * was put aside in March stays worth what it was worth in March, which is what keeps a bar from
 * retreating because a rate moved (#93 pt. 4).
 *
 * In the ordinary case none of this runs at all: a goal takes the preferred currency when it is
 * made, so the goal and the screen agree and the converter has nothing to do.
 */
export const useGoals = () => {
  const { settings } = useSettings();

  const goals = useLiveQuery(() => db.goals.toArray(), []) || [];
  const contributions = useLiveQuery(() => db.contributions.toArray(), []) || [];
  const closedWindows = useLiveQuery(() => db.closedWindows.toArray(), []) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray(), []) || [];

  const { earliest } = getEarliestAndLatestDate(contributions, 'contributedAt', 'iso-date');
  const { data: exchangeRates } = useListExchangeRatesQuery(
    { fromDate: earliest as string, toDate: toISODate(new Date()) },
    { skip: !earliest }
  );

  const currency = settings?.currency;

  const inOneCurrency = <T extends { currency?: unknown }>(
    data: T[],
    amountKey: string,
    dateKey?: string
  ) =>
    currency
      ? convertDataToDesiredCurrency({
          data: data as never,
          exchangeRates,
          desiredCurrency: currency,
          amountKey,
          dateKey,
        })
      : data;

  const contributionsWithCurrency = contributions.map((contribution) => ({
    ...contribution,
    currency: goals.find((goal) => goal.id === contribution.goalId)?.currency,
  }));

  const convertedGoals = inOneCurrency(goals, 'target') as typeof goals;
  const convertedContributions = inOneCurrency(
    contributionsWithCurrency,
    'amount',
    'contributedAt'
  ) as typeof contributions;

  const today = new Date();

  return {
    // The screen always has a currency to print in; conversion is gated on the stored one, so an
    // unset setting shows the default rather than converting into nothing and emptying the list.
    currency: currency ?? DEFAULT_SETTINGS.currency,
    hasEmergencyFund: goals.some(isEmergencyFund),
    progress: goalProgress({
      goals: convertedGoals,
      contributions: convertedContributions,
      closedWindows,
      expenses: inOneCurrency(expenses, 'expense') as typeof expenses,
      today,
    }),
    totalPutAside: totalPutAside({
      goals: convertedGoals,
      contributions: convertedContributions,
    }),
  };
};
