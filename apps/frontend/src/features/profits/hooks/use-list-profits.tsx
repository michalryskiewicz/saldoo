import { useSettings } from '@/features/settings/use-settings.ts';
import { useListExchangeRatesQuery } from '@/store/exchange-rates.api.ts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { convertDataToDesiredCurrency } from '@/lib/exchange-rate.ts';
import { getEarliestAndLatestDate, toISODate } from '@/lib/dates.ts';

export const useListProfits = () => {
  // ===========================================================================
  // Selectors
  // ===========================================================================
  const allProfits = useLiveQuery(() => db.profits.toArray()) || [];

  // ===========================================================================
  // RTK Query
  // ===========================================================================
  const { settings } = useSettings();

  // Taken from the records, the way every other screen takes it. It used to open at a hardcoded
  // 1 October 2025 — a date with no meaning to anybody's data, asking for a window that grows by a
  // day every day and will one day ask for a decade of rates to convert a handful of incomes.
  //
  // These are converted at today's rate rather than at each income's own day, so the window only
  // has to reach today; the earlier bound is what keeps the request small.
  const { earliest } = getEarliestAndLatestDate(allProfits, 'execution', 'iso-date');
  const todayISO = toISODate(new Date());
  const { data: exchanges } = useListExchangeRatesQuery(
    { fromDate: (earliest as string) ?? todayISO, toDate: todayISO },
    { skip: !allProfits.length }
  );

  // ===========================================================================
  // State
  // ===========================================================================
  const allProfitsInDesiredCurrency = convertDataToDesiredCurrency({
    data: allProfits,
    exchangeRates: exchanges,
    desiredCurrency: settings?.currency,
    amountKey: 'profit',
  });

  // ===========================================================================
  // Return
  // ===========================================================================
  return { allProfits: allProfitsInDesiredCurrency };
};
