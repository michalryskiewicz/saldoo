import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useSettings } from '@/features/settings/use-settings.ts';
import { convertDataToDesiredCurrency } from '@/lib/exchange-rate.ts';

import { getEarliestAndLatestDate, getFromDate } from '@/lib/dates.ts';
import { useListExchangeRatesQuery } from '@/store/exchange-rates.api.ts';
import { startOfMonth, format } from 'date-fns';
import {
  calculateFinancialSafetyNet,
  groupExpensesAndProfitsByMonth,
  groupExpensesByCategory,
  groupExpensesByStrategyPart,
} from '@/lib/expenses.ts';
import { useListTags } from '@/database/hooks/use-list-tags.tsx';
import { spendingByDayOfMonth } from '@/lib/monthly-spending.ts';
import { expenseAmountForMonth } from '@/lib/expense-amount.ts';

export const useOverviewData = () => {
  // ===========================================================================
  // Hooks
  // ===========================================================================
  const { settings, isLoading: areSettingsLoading } = useSettings();

  // ===========================================================================
  // Database
  // ===========================================================================
  const expenses = useLiveQuery(() => db.expenses.toArray(), []) || [];
  const profits = useLiveQuery(() => db.profits.toArray(), []) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];
  const duties = useLiveQuery(() => db.duties.toArray(), []) || [];
  const { tags } = useListTags();

  // ===========================================================================
  // Local State
  // ===========================================================================
  const { earliest, latest } = getEarliestAndLatestDate(
    transactions,
    'transactionDate',
    'iso-date'
  );

  // ===========================================================================
  // RTK Query
  // ===========================================================================
  const { data: exchangesForTransaction, isLoading: isExchangeRateForTransactionsLoading } =
    useListExchangeRatesQuery(
      {
        fromDate: earliest as string,
        toDate: latest as string,
      },
      {
        skip: !earliest && !latest,
      }
    );

  const { data: exchangesForExpensesProfitsAndDuties, isLoading: areExchangeRatesLoading } =
    useListExchangeRatesQuery({
      fromDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      toDate: new Date().toISOString().split('T')[0],
    });

  // Merge tags into expenses
  const expensesWithTag = expenses.map((expense) => ({
    ...expense,
    tag: tags?.find((tag) => tag.id === expense.tagId) || undefined,
  }));

  // Merge expenses into duties
  const calendarMonthOf = (day: Date | string) => {
    const date = new Date(day);

    return { year: date.getFullYear(), monthIndex: date.getMonth() };
  };

  const dutiesWithExpense = duties.map((duty) => {
    const expense = expensesWithTag?.find((expense) => expense.id === duty.expenseId);
    return {
      ...duty,
      expense: expense ?? null,
      // Not `expense.expense`, which is meaningless for a cost that is a share of an income: the
      // amount owed depends on which month the occurrence falls in.
      price: expense ? expenseAmountForMonth(expense, profits, calendarMonthOf(duty.executionDate)) : 0,
      currency: expense?.currency || 'EUR',
    };
  });

  const preferredCurrency = settings?.currency ?? 'EUR';

  const expensesInSelectedCurrency = convertDataToDesiredCurrency({
    data: expensesWithTag,
    exchangeRates: exchangesForExpensesProfitsAndDuties,
    desiredCurrency: preferredCurrency,
    amountKey: 'expense',
  });

  const profitsInSelectedCurrency = convertDataToDesiredCurrency({
    data: profits,
    exchangeRates: exchangesForExpensesProfitsAndDuties,
    desiredCurrency: preferredCurrency,
    amountKey: 'profit',
  });

  const dutiesWithExpenseInSelectedCurrency = convertDataToDesiredCurrency({
    data: dutiesWithExpense,
    exchangeRates: exchangesForExpensesProfitsAndDuties,
    desiredCurrency: preferredCurrency,
    amountKey: 'price',
  });

  const transactionsInSelectedCurrency = convertDataToDesiredCurrency({
    data: transactions,
    exchangeRates: exchangesForTransaction,
    desiredCurrency: preferredCurrency,
    amountKey: 'amount',
    dateKey: 'transactionDate',
  });

  const chartData = groupExpensesAndProfitsByMonth(
    expensesInSelectedCurrency,
    profitsInSelectedCurrency
  );

  const { month: monthIndex } = getFromDate(new Date());

  const radialChart = groupExpensesByCategory(
    monthIndex,
    expensesInSelectedCurrency,
    profitsInSelectedCurrency
  );

  const expensesByStrategyPart = groupExpensesByStrategyPart(
    monthIndex,
    expensesInSelectedCurrency,
    transactionsInSelectedCurrency,
    dutiesWithExpenseInSelectedCurrency,
    profitsInSelectedCurrency
  );

  const savings = chartData.find((c) => c.month === monthIndex);

  const maxRadialChartItem =
    radialChart && radialChart.length > 0
      ? radialChart.reduce((max, item) => (item.total > max.total ? item : max), radialChart[0])
      : undefined;

  const financialSafetyNet = calculateFinancialSafetyNet(monthIndex, expensesInSelectedCurrency);

  const financialSafetyNetToReturn = {
    ...financialSafetyNet,
    currency: preferredCurrency,
  };

  const monthlySpending = spendingByDayOfMonth(transactionsInSelectedCurrency, new Date());

  return {
    currency: preferredCurrency,
    savings: (savings?.totalProfits || 0) - (savings?.totalExpense || 0),
    totalExpense: savings?.totalExpense || 0,
    totalProfits: savings?.totalProfits || 0,
    radialChart,
    chartData,
    maxRadialChartItem,
    expensesByStrategyPart,
    financialSafetyNet: financialSafetyNetToReturn,
    monthlySpending,
    tags,
    settings,
    hasExpenses: expenses.length > 0,
    hasProfits: profits.length > 0,
    hasTransactions: transactions.length > 0,
    isLoading: areSettingsLoading || isExchangeRateForTransactionsLoading || areExchangeRatesLoading,
  };
};
