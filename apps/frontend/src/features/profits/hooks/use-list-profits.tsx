import { useSettings } from '@/features/settings/use-settings.ts';
import { useListExchangeRatesQuery } from '@/store/exchange-rates.api.ts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { convertDataToDesiredCurrency } from '@/lib/exchange-rate.ts';

export const useListProfits = () => {
  // ===========================================================================
  // RTK Query
  // ===========================================================================
  const { settings } = useSettings();
  const { data: exchanges } = useListExchangeRatesQuery({
    fromDate: new Date(2025, 9, 1).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
  });

  // ===========================================================================
  // Selectors
  // ===========================================================================
  const allProfits = useLiveQuery(() => db.profits.toArray()) || [];

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
