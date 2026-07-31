import TransactionsDataTableTopBar from '@/features/transactions/views/transactions-data-table-top-bar.tsx';
import { DataTable } from '@/components/ui/data-table.tsx';
import type { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Cell, Header } from '@/components/tanstack-table';
import { formatDate } from '@/lib/formats.ts';
import i18n, { type TranslationKey } from '@/i18n.ts';
import type { DBTransaction } from '@/database/transactions.ts';
import { InfoTooltip } from '@/components/info-tooltip.tsx';
import { useTransactionsData } from '@/features/transactions/hooks/use-transactions-data.tsx';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBTag } from '@/database/tags.ts';

const columns: ColumnDef<DBTransaction & { expense: DBExpense; tag: DBTag }>[] = [
  {
    id: 'select',
    meta: { align: 'center' as const },
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
    filterFn: 'includesString',
    cell: ({ row }) => (
      <div className="flex flex-row justify-between gap-2">
        <Cell.Text
          className=" overflow-hidden whitespace-nowrap text-ellipsis"
          name={row.original.description}
        />
        <InfoTooltip text={row.original.description} />
      </div>
    ),
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => <Header.Sort column={column} header="expense" />,
    cell: ({ row }) => {
      const { id, amount, currency } = row.original;
      return <Cell.Money id={id} price={amount} currency={currency} />;
    },
  },
  {
    accessorKey: 'transactionDate',
    header: i18n.t('transaction_date'),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    filterFn: 'dateBetweenFilterFn',
    cell: ({ row }) => {
      if (!row.original.transactionDate) {
        return '-';
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
    header: i18n.t('forms.strategy-part'),
    cell: ({ row }) => <Cell.Tags tag={i18n.t(row.original?.strategyPart as TranslationKey)} />,
  },
  {
    accessorKey: 'expense',
    header: i18n.t('forms.expense'),
    cell: ({ row }) => (
      <Cell.Tags tag={i18n.t(row.original?.expense?.description as TranslationKey)} />
    ),
  },
];

export const TransactionsTable = () => {
  const { transactions } = useTransactionsData();
  return (
    <DataTable
      //eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-expect-error
      columns={columns}
      data={transactions || []}
      children={(table) => {
        //eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-expect-error
        return <TransactionsDataTableTopBar table={table} />;
      }}
    />
  );
};
