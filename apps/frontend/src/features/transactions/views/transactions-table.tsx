import TransactionsDataTableTopBar from '@/features/transactions/views/transactions-data-table-top-bar.tsx';
import { DataTable } from '@/components/ui/data-table.tsx';
import type { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Cell, Header } from '@/components/tanstack-table';
import { formatDate } from '@/lib/formats.ts';
import i18n, { type TranslationKey } from '@/i18n.ts';
import type { DBTransaction } from '@/database/transactions.ts';
import { useTransactionsData } from '@/features/transactions/hooks/use-transactions-data.tsx';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBTag } from '@/database/tags.ts';
import { useState } from 'react';
import { searchTransactions } from '@/features/transactions/services/transactions-search.service.ts';
import {
  selectTransactionsInRange,
  type TransactionRange,
} from '@/features/transactions/services/transactions-range.service.ts';

/** A row as this table sees it: a payment with the expense and the category it was filed under. */
export type TransactionRow = DBTransaction & { expense?: DBExpense; tag?: DBTag };

const columns: ColumnDef<TransactionRow>[] = [
  {
    id: 'select',
    meta: { align: 'center' as const, mobile: 'actions' as const },
    accessorKey: 'id',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label={i18n.t('table.select_all')}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={i18n.t('table.select_row')}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'description',
    meta: { grow: true },
    header: ({ column }) => <Header.Sort column={column} header="description" />,
    // A bank writes long titles and the column that grows is still not endless, so it truncates
    // — with the whole of it in the element's own title rather than beside a glyph to hover. That
    // glyph sat at the right-hand edge of the growing column, which put a lone "?" in the middle
    // of every row, saying nothing about the row it was in.
    cell: ({ row }) => (
      <p className="truncate" title={row.original.description}>
        {row.original.description}
      </p>
    ),
  },
  {
    accessorKey: 'amount',
    meta: { mobile: 'figure' as const },
    header: ({ column }) => <Header.Sort column={column} header="amount" />,
    cell: ({ row }) => {
      const { id, amount, currency } = row.original;
      return <Cell.Money id={id} price={amount} currency={currency} />;
    },
  },
  {
    accessorKey: 'transactionDate',
    header: ({ column }) => <Header.Sort column={column} header="transaction_date" />,
    cell: ({ row }) => {
      if (!row.original.transactionDate) {
        return null;
      }
      return <Cell.Text name={formatDate(row.original.transactionDate)} />;
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
    accessorKey: 'expense.description',
    meta: { mobile: 'hidden' as const },
    header: i18n.t('settled_expense'),
    cell: ({ row }) => <Cell.Tags tag={row.original?.expense?.description} />,
  },
];

export const TransactionsTable = () => {
  const { transactions } = useTransactionsData();
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<TransactionRange>('all');

  // Both filters applied before the table sees the rows, rather than as column filters inside it.
  // The period is one column's business but the search is not — it reaches the category and the
  // expense a payment was filed under, neither of which the bank's title contains.
  const dataToTable = searchTransactions(
    selectTransactionsInRange(transactions ?? [], range, new Date()),
    query
  );

  return (
    <DataTable
      columns={columns}
      data={dataToTable}
      // A ledger reads newest first, or it reads in whatever order the parser happened to produce
      // — which is what it was doing.
      initialSorting={[{ id: 'transactionDate', desc: true }]}
      emptyMessage={query ? i18n.t('table.no_search_results', { query }) : undefined}
    >
      {(table) => (
        <TransactionsDataTableTopBar
          table={table}
          query={query}
          onQueryChange={setQuery}
          range={range}
          onRangeChange={setRange}
        />
      )}
    </DataTable>
  );
};
