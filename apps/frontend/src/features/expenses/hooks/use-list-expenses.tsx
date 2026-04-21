import { useGetProfileQuery } from '@/store/profile-slice.api.ts';
import { useListExchangeRatesQuery } from '@/store/exchange-rates.api.ts';
import { groupExpensesByMonth } from '@/lib/expenses.ts';
import { combineExpensesWithTags } from '@/features/expenses/hooks/list-expenses.serivce.ts';
import { convertDataToDesiredCurrency } from '@/lib/exchange-rate.ts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { getEarliestAndLatestDate, toISODate } from '@/lib/dates.ts';
import { useListTags } from '@/database/hooks/use-list-tags.tsx';

export const useListExpenses = () => {
  // ===========================================================================
  // Database
  // ===========================================================================
  const allExpenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const { tags } = useListTags();

  // ===========================================================================
  // Local State
  // ===========================================================================
  const { earliest, latest } = getEarliestAndLatestDate(allExpenses, 'execution', 'iso-date');

  // ===========================================================================
  // RTK Query
  // ===========================================================================
  const { data: profile } = useGetProfileQuery();
  const { data: exchanges } = useListExchangeRatesQuery(
    {
      fromDate: earliest as string,
      toDate: toISODate(new Date()),
    },
    {
      skip: !earliest && !latest,
    }
  );

  // ===========================================================================
  // State
  // ===========================================================================
  const allExpensesInDesiredCurrency = convertDataToDesiredCurrency({
    data: allExpenses,
    exchangeRates: exchanges,
    desiredCurrency: profile?.currency,
    amountKey: 'expense',
  });

  const expensesWithTags = combineExpensesWithTags(allExpensesInDesiredCurrency, tags);
  const chartData = groupExpensesByMonth(expensesWithTags);

  // ===========================================================================
  // Return
  // ===========================================================================
  return { chartData, allExpenses: expensesWithTags };
};
