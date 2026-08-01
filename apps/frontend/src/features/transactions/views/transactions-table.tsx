import TransactionsDataTableTopBar from '@/features/transactions/views/transactions-data-table-top-bar.tsx';
import { DataTable } from '@/components/ui/data-table.tsx';
import type { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Cell, Header } from '@/components/tanstack-table';
import { formatDate } from '@/lib/formats.ts';
import i18n from '@/i18n.ts';
import type { DBTransaction } from '@/database/transactions.ts';
import { useTransactionsData } from '@/features/transactions/hooks/use-transactions-data.tsx';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBTag } from '@/database/tags.ts';
import { TOTAL } from '@/constant.ts';
import TransactionAssignmentCell from '@/features/transactions/components/transaction-assignment-cell.tsx';
import TransactionsSummaryCell from '@/features/transactions/components/transactions-summary-cell.tsx';
import { transactionAssignments } from '@/features/transactions/services/transactions-assignment.service.ts';
import {
  summariseTransactions,
  type TransactionsSummary,
} from '@/features/transactions/services/transactions-summary.service.ts';
import { useState } from 'react';
import { searchTransactions } from '@/features/transactions/services/transactions-search.service.ts';
import {
  selectTransactionsInRange,
  type TransactionRange,
} from '@/features/transactions/services/transactions-range.service.ts';

/**
 * A row as this table sees it: a payment with the expense and the category it was filed under.
 *
 * `summary` rides on the summary row rather than being read from the visible rows by the column
 * definitions, which are module-level and know nothing about state. Carrying it as data keeps
 * the columns a constant — rebuilt per render they would reset the table's own sorting.
 */
export type TransactionRow = DBTransaction & {
  expense?: DBExpense;
  tag?: DBTag;
  summary?: TransactionsSummary;
};

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
    cell: ({ row }) => {
      if (row.original.id === TOTAL) return null;

      return (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={i18n.t('table.select_row')}
        />
      );
    },
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
    cell: ({ row }) => {
      if (row.original.id === TOTAL) return null;

      return (
        <p className="truncate" title={row.original.description}>
          {row.original.description}
        </p>
      );
    },
  },
  {
    accessorKey: 'amount',
    meta: { mobile: 'figure' as const },
    header: ({ column }) => <Header.Sort column={column} header="amount" />,
    cell: ({ row }) => {
      const { id, amount, currency, summary } = row.original;

      if (summary) return <TransactionsSummaryCell summary={summary} />;

      return <Cell.Money id={id} price={amount} currency={currency} directional />;
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
    id: 'assignment',
    // The filings joined into one value, so a phone can tell a payment that has been filed from
    // one that has not: a detail with nothing in it contributes a separator and no word.
    accessorFn: (row) =>
      transactionAssignments(row)
        .map((assignment) => assignment.value)
        .join(' ') || undefined,
    header: i18n.t('assignment'),
    cell: ({ row }) => <TransactionAssignmentCell assignments={transactionAssignments(row.original)} />,
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

  // A summary row rather than a stored payment, so it is shaped like one on purpose.
  const totalRow: TransactionRow[] = dataToTable.length
    ? [
        {
          id: TOTAL,
          createdAt: new Date(),
          sourceBank: '',
          description: '',
          hash: TOTAL,
          transactionDate: '',
          amount: 0,
          currency: dataToTable[0].currency,
          summary: summariseTransactions(dataToTable),
        },
      ]
    : [];

  return (
    <DataTable
      columns={columns}
      data={[...dataToTable, ...totalRow]}
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
