import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useSettings } from '@/features/settings/use-settings.ts';
import { useListExchangeRatesQuery } from '@/store/exchange-rates.api.ts';
import { convertDataToDesiredCurrency } from '@/lib/exchange-rate.ts';
import { getEarliestAndLatestDate, toISODate } from '@/lib/dates.ts';
import { goalProgress, totalPutAside } from '@/features/goals/services/goal-progress.service.ts';
import { applyDBRollovers, isEmergencyFund } from '@/database/goals.ts';
import { rolloversDue } from '@/features/goals/services/rollover.service.ts';
import { confirmedPortion } from '@/features/goals/services/goal-months.service.ts';
import { DEFAULT_SETTINGS } from '@/database/settings.service.ts';
import { useNetWorth } from '@/features/net-worth/hooks/use-net-worth.tsx';

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

  // What stands behind a goal, already in one currency — the net worth screen owns that join and
  // there is no second way to do it that could disagree with it.
  const { holdings } = useNetWorth();

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

  // The turn of the year, applied when somebody next opens the screen. There is no clock running
  // in a local-first app that may be shut for a fortnight, so the work happens on the first visit
  // of the new year instead — which is also the first moment it could be seen.
  //
  // The guard is a ref rather than the effect's own dependencies: `useLiveQuery` re-emits the
  // moment the first write lands, and without it the second pass would start before the first had
  // finished writing the goal that makes it a no-op.
  const rollingOver = useRef(false);

  useEffect(() => {
    const due = rolloversDue({ goals, contributions, today: new Date() });

    if (!due.length || rollingOver.current) return;

    rollingOver.current = true;
    applyDBRollovers(due).finally(() => {
      rollingOver.current = false;
    });
  }, [goals, contributions]);

  return {
    // The screen always has a currency to print in; conversion is gated on the stored one, so an
    // unset setting shows the default rather than converting into nothing and emptying the list.
    currency: currency ?? DEFAULT_SETTINGS.currency,
    hasEmergencyFund: goals.some(isEmergencyFund),
    progress: goalProgress({
      holdings,
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
    // Beside the figure, never instead of it: a contribution with nothing behind it is most often
    // a transfer somebody meant to make and did, days before their bank got round to saying so.
    confirmed: confirmedPortion(
      convertedContributions.filter((contribution) =>
        convertedGoals.some(
          (goal) => goal.id === contribution.goalId && !isEmergencyFund(goal)
        )
      )
    ).confirmed,
  };
};
