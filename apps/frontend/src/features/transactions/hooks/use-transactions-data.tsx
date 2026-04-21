import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import React from 'react';
import { useListTags } from '@/database/hooks/use-list-tags.tsx';

export const useTransactionsData = () => {
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const expenses = useLiveQuery(() => db.expenses.toArray());
  const { tags } = useListTags();

  const expensesMap = React.useMemo(
    () => (expenses ? Object.fromEntries(expenses.map((expense) => [expense.id, expense])) : {}),
    [expenses]
  );

  const tagsMap = React.useMemo(
    () => (tags ? Object.fromEntries(tags.map((tag) => [tag.id, tag])) : {}),
    [tags]
  );

  const transactionsWithExpenseAndTag = React.useMemo(
    () =>
      transactions
        ? transactions.map((tx) => ({
            ...tx,
            expense: tx.expenseId ? expensesMap[tx.expenseId] : undefined,
            tag: tx.tagId ? tagsMap[tx.tagId] : undefined,
          }))
        : [],
    [transactions, expensesMap, tagsMap]
  );

  return { transactions: transactionsWithExpenseAndTag };
};
