import type { ColumnDef } from '@tanstack/react-table';
import { formatRecurrence } from '@/lib/formats.ts';
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
import { costInYear } from '@/lib/recurrence.ts';

/**
 * A row as the table sees it: an expense with its tag joined in.
 *
 * `totalLabel` rides on the summary row rather than being read from state by the column
 * definitions, which are module-level and know nothing about it. Carrying it as data keeps the
 * columns a constant — rebuilt per render they would reset the table's own sorting.
 */
export type ExpenseRow = DBExpense & { tag?: DBTag; totalLabel?: string };

// eslint-disable-next-line react-refresh/only-export-components
export const columns: ColumnDef<ExpenseRow>[] = [
  {
    accessorKey: 'description',
    meta: { grow: true },
    cell: ({ row }) => (
      <Cell.Description
        id={row.original.id}
        name={row.original.description}
        totalLabel={row.original.totalLabel}
      />
    ),
    header: ({ column }) => <Header.Sort column={column} header="description" />,
  },
  {
    accessorKey: 'expense',
    // Blank on the summary: the amount as entered is a property of one plan, and twelve plans
    // of different frequencies have no shared amount to add up. What they do have is what they
    // cost over a year, which is the column beside this one.
    cell: ({ row }) => {
      const { id, expense, currency } = row.original;

      if (id === TOTAL) return null;

      return <Cell.Money id={id} price={expense} currency={currency} />;
    },
    header: ({ column }) => (
      <Header.Info column={column} header="expense" tooltip="price_exchanged_automatically" />
    ),
  },
  {
    id: 'yearlyCost',
    // The figure on a phone, and the one the summary adds: it is the only column in this table
    // whose rows are comparable with each other. `accessorFn` rather than a stored field, so
    // sorting by it sorts by the cost and not by the number that happens to be typed in.
    meta: { mobile: 'figure' as const },
    // The summary carries its figure already: it is a sum of years, not a plan with a year of
    // its own, and asking what a total recurs at answers nothing.
    accessorFn: (row) =>
      row.id === TOTAL ? row.expense : costInYear(row, row.expense, new Date().getFullYear()),
    cell: ({ row, getValue }) => (
      <Cell.Money
        id={row.original.id}
        price={getValue<number>()}
        currency={row.original.currency}
      />
    ),
    header: ({ column }) => <Header.Sort column={column} header="yearly_cost" />,
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
    accessorKey: 'frequency',
    header: i18n.t('frequency'),
    cell: ({ row }) => {
      const { id, execution, frequency, interval, endsAt } = row.original;
      return <Cell.Text id={id} name={formatRecurrence(execution, frequency, interval, endsAt)} />;
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
  //
  // A year is the shortest window in which these rows can be added up at all. Summing the
  // amounts as entered put a weekly figure beside a yearly one and called the result a total; a
  // single month would be honest but would read as zero for eleven twelfths of every yearly
  // cost. Counted over a year, every plan contributes what it actually costs.
  const year = new Date().getFullYear();
  const totalRow: ExpenseRow[] = dataToTable.length
    ? [
        {
          id: TOTAL,
          createdAt: new Date(),
          description: 'TOTAL',
          totalLabel: i18n.t('total_yearly'),
          expense: dataToTable.reduce((total, row) => total + costInYear(row, row.expense, year), 0),
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
