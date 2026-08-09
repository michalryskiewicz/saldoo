import { useSettings } from '@/features/settings/use-settings.ts';
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
  const allProfits = useLiveQuery(() => db.profits.toArray()) || [];
  const { tags } = useListTags();

  // ===========================================================================
  // Local State
  // ===========================================================================
  const { earliest } = getEarliestAndLatestDate(allExpenses, 'execution', 'iso-date');

  // ===========================================================================
  // RTK Query
  // ===========================================================================
  const { settings } = useSettings();
  // Gated on there being anything to convert, rather than on the *expenses* having a date: the
  // incomes on this screen go through the converter too, so an account with incomes and no expenses
  // yet asked for no rates at all and printed them in złoty under whichever sign it reads in.
  const { data: exchanges } = useListExchangeRatesQuery(
    {
      fromDate: (earliest as string) ?? toISODate(new Date()),
      toDate: toISODate(new Date()),
    },
    {
      skip: !allExpenses.length && !allProfits.length,
    }
  );

  // ===========================================================================
  // State
  // ===========================================================================
  const allExpensesInDesiredCurrency = convertDataToDesiredCurrency({
    data: allExpenses,
    exchangeRates: exchanges,
    desiredCurrency: settings?.currency,
    amountKey: 'expense',
  });

  // The base a share is taken of has to already be in the currency the answer is wanted in: a
  // percentage is dimensionless, so the amount it produces has the currency of its base and none
  // of its own. Converting the result afterwards would convert it twice.
  const profitsInDesiredCurrency = convertDataToDesiredCurrency({
    data: allProfits,
    exchangeRates: exchanges,
    desiredCurrency: settings?.currency,
    amountKey: 'profit',
  });

  const expensesWithTags = combineExpensesWithTags(allExpensesInDesiredCurrency, tags);
  const chartData = groupExpensesByMonth(expensesWithTags, profitsInDesiredCurrency);

  // ===========================================================================
  // Return
  // ===========================================================================
  return { chartData, allExpenses: expensesWithTags, profits: profitsInDesiredCurrency };
};
