import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import React from 'react';
import { useListTags } from '@/database/hooks/use-list-tags.tsx';
import { useSettings } from '@/features/settings/use-settings.ts';
import { useListExchangeRatesQuery } from '@/store/exchange-rates.api.ts';
import { getEarliestAndLatestDate, toISODate } from '@/lib/dates.ts';
import { DEFAULT_SETTINGS } from '@/database/settings.service.ts';
import { withPreferredCurrency } from '@/features/transactions/services/transactions-summary.service.ts';

export const useTransactionsData = () => {
  const { settings } = useSettings();
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const expenses = useLiveQuery(() => db.expenses.toArray());
  const { tags } = useListTags();

  // A statement is history, so the window it needs is the one its own payments fall in — each
  // converted at the rate of the day it was paid, never today's.
  const { earliest, latest } = getEarliestAndLatestDate(
    transactions ?? [],
    'transactionDate',
    'iso-date'
  );

  const { data: exchangeRates } = useListExchangeRatesQuery(
    {
      fromDate: (earliest as string) ?? toISODate(new Date()),
      toDate: (latest as string) ?? toISODate(new Date()),
    },
    { skip: !earliest }
  );

  const currency = settings?.currency ?? DEFAULT_SETTINGS.currency;

  const expensesMap = React.useMemo(
    () => (expenses ? Object.fromEntries(expenses.map((expense) => [expense.id, expense])) : {}),
    [expenses]
  );

  const tagsMap = React.useMemo(
    () => (tags ? Object.fromEntries(tags.map((tag) => [tag.id, tag])) : {}),
    [tags]
  );

  // Each row keeps the money the bank wrote it in — a statement read back in another currency is
  // no longer the statement. What the preferred currency is for is the figure underneath, which
  // has to be one currency to be a total at all, so the converted amount rides alongside the
  // original instead of replacing it.
  const transactionsWithExpenseAndTag = React.useMemo(
    () =>
      withPreferredCurrency(
        transactions?.map((tx) => ({
          ...tx,
          expense: tx.expenseId ? expensesMap[tx.expenseId] : undefined,
          tag: tx.tagId ? tagsMap[tx.tagId] : undefined,
        })) ?? [],
        currency,
        exchangeRates
      ),
    [transactions, expensesMap, tagsMap, currency, exchangeRates]
  );

  return { transactions: transactionsWithExpenseAndTag, currency };
};
