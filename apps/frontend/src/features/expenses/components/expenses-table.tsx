import type { ColumnDef } from '@tanstack/react-table';
import { formatFrequency } from '@/lib/formats.ts';
import { DataTable } from '@/components/ui/data-table.tsx';
import { TableSearch } from '@/components/ui/table-search.tsx';
import { searchExpenses } from '@/features/expenses/services/expenses-search.service.ts';
import { TOTAL } from '@/constant.ts';
import i18n, { type TranslationKey } from '@/i18n.ts';
import ExpensesTableActions from '@/features/expenses/components/expenses-table-actions.tsx';
import { useState } from 'react';
import { Cell, Header } from '@/components/tanstack-table';
import { useListExpenses } from '@/features/expenses/hooks/use-list-expenses.tsx';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBTag } from '@/database/tags.ts';

/** A row as the table sees it: an expense with its tag joined in. */
export type ExpenseRow = DBExpense & { tag?: DBTag };

// eslint-disable-next-line react-refresh/only-export-components
export const columns: ColumnDef<ExpenseRow>[] = [
  {
    accessorKey: 'description',
    meta: { grow: true },
    cell: ({ row }) => <Cell.Description id={row.original.id} name={row.original.description} />,
    header: ({ column }) => <Header.Sort column={column} header="description" />,
  },
  {
    accessorKey: 'expense',
    meta: { mobile: 'figure' as const },
    cell: ({ row }) => {
      const { id, expense, currency } = row.original;
      return <Cell.Money id={id} price={expense} currency={currency} />;
    },
    header: ({ column }) => (
      <Header.Info column={column} header="expense" tooltip="price_exchanged_automatically" />
    ),
  },
  {
    accessorKey: 'severity',
    header: ({ column }) => <Header.Sort column={column} header="severity" />,
    cell: ({ row }) => {
      const { id, severity } = row.original;
      return <Cell.Severity id={id} severity={severity} />;
    },
  },
  {
    accessorKey: 'execution',
    header: i18n.t('execution'),
    cell: ({ row }) => {
      const { id, execution, frequency } = row.original;
      return <Cell.Text id={id} name={formatFrequency(execution, frequency)} />;
    },
  },
  {
    accessorKey: 'frequency',
    meta: { mobile: 'hidden' as const },
    header: i18n.t('frequency'),
    cell: ({ row }) => {
      const { id, frequency } = row.original;
      return <Cell.Frequency id={id} frequency={frequency} />;
    },
  },
  {
    accessorKey: 'tag.name',
    header: i18n.t('forms.category'),
    cell: ({ row }) => <Cell.Tags tag={row.original?.tag?.name} />,
  },
  {
    accessorKey: 'strategyPart',
    meta: { mobile: 'hidden' as const },
    header: i18n.t('forms.strategy-part'),
    cell: ({ row }) => <Cell.Tags tag={i18n.t(row.original?.strategyPart as TranslationKey)} />,
  },
  {
    id: 'actions',
    meta: { mobile: 'actions' as const },
    cell: ({ row }) => {
      if (row.original.id === TOTAL) {
        return null;
      }
      return <ExpensesTableActions expenseId={row.original.id} />;
    },
  },
];

export const ExpensesTable = () => {
  const { allExpenses } = useListExpenses();
  const [query, setQuery] = useState('');

  // Filtered before the table sees it, so the summary is a total of what is on the screen. Were
  // the search inside the table, the rows would narrow and the total would go on reporting the
  // sum of everything -- a figure that answers a question nobody asked.
  const dataToTable = searchExpenses(allExpenses ?? [], query);

  // A summary row rather than a stored expense, so it is shaped like one on purpose.
  const totalRow: ExpenseRow[] = dataToTable.length
    ? [
        {
          id: TOTAL,
          createdAt: new Date(),
          description: 'TOTAL',
          expense: dataToTable.reduce((acc, curr) => acc + (curr.expense || 0), 0),
          currency: dataToTable[0].currency,
          severity: null,
        },
      ]
    : [];

  return (
    <DataTable
      columns={columns}
      data={[...dataToTable, ...totalRow]}
      emptyMessage={query ? i18n.t('table.no_search_results', { query }) : undefined}
    >
      {() => <TableSearch value={query} onChange={setQuery} />}
    </DataTable>
  );
};
