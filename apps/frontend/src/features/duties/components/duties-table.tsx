import { DataTable } from '@/components/ui/data-table.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import DateRangeSelector from '@/features/duties/components/date-range-selector.tsx';
import i18n, { type TranslationKey } from '@/i18n.ts';
import { formatFrequency } from '@/lib/formats.ts';
import type { ColumnDef } from '@tanstack/react-table';
import { Cell, Header } from '@/components/tanstack-table';
import { TOTAL } from '@/constant.ts';
import DutiesTableActions from '@/features/duties/components/duties-table-actions.tsx';
import { useDuties } from '@/features/duties/hooks/use-duties.tsx';
import { type DBDuty, resolveDBDuty } from '@/database/duty.ts';
import type { DBExpense } from '@/database/expenses.ts';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';

const columns: ColumnDef<DBDuty & { expense: DBExpense }>[] = [
  {
    accessorKey: 'expense.description',
    cell: ({ row }) => (
      <Cell.Description id={row.original.id} name={row.original.expense.description} />
    ),
    header: ({ column }) => <Header.Sort column={column} header="description" />,
  },
  {
    accessorKey: 'expense',
    header: i18n.t('expense'),
    cell: ({ row }) => {
      const { id, expense, currency } = row.original.expense;
      return <Cell.Money id={id} price={expense} currency={currency} />;
    },
  },
  {
    accessorKey: 'expense.severity',
    header: ({ column }) => <Header.Sort column={column} header="severity" />,
    cell: ({ row }) => {
      const { id, severity } = row.original.expense;
      return <Cell.Severity id={id} severity={severity} />;
    },
  },
  {
    accessorKey: 'expense.execution',
    header: i18n.t('execution'),
    cell: ({ row }) => {
      const { id, execution, frequency } = row.original.expense;
      return <Cell.Text id={id} name={formatFrequency(execution, frequency)} />;
    },
  },
  {
    accessorKey: 'expense.frequency',
    header: i18n.t('frequency'),
    cell: ({ row }) => {
      const { id, frequency } = row.original.expense;
      return <Cell.Frequency id={id} frequency={frequency} />;
    },
  },
  {
    id: 'select',
    accessorKey: 'resolved',
    header: i18n.t('resolved'),
    cell: ({ row }) => {
      return (
        <>
          <Checkbox
            checked={row.original.resolved}
            onCheckedChange={async () => resolveDBDuty(row.original.id, !row?.original?.resolved)}
            aria-label="Select row"
          />
          {row.original.transactionId && row.original.resolved && '💳'}
          {!row.original.transactionId && row.original.resolved && '🖐'}
        </>
      );
    },
  },
  {
    id: 'actions',
    maxSize: 30,
    cell: ({ row }) => {
      if (row.original.id === TOTAL) {
        return null;
      }
      return <DutiesTableActions row={row} />;
    },
  },
];

export default function DutiesTable() {
  const { duties } = useDuties();
  const [paidFilter, setPaidFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  let dataToTable = duties ?? [];

  dataToTable = dataToTable.filter((t) => {
    if (paidFilter === 'all') return true;
    if (paidFilter === 'paid') return t.resolved === true;
    return !t.resolved;
  });

  const totalRow = dataToTable.length
    ? [
        {
          id: TOTAL,
          resolved: false,
          transactionId: undefined,
          expense: {
            id: TOTAL,
            description: 'TOTAL',
            expense: dataToTable.reduce((acc, curr) => acc + (curr?.expense?.expense || 0), 0),
            currency: dataToTable?.[0]?.expense?.currency,
            severity: null,
            execution: undefined,
            frequency: undefined,
            tags: [],
          },
        },
      ]
    : [];

  return (
    <>
      <div className="flex flex-col w-full justify-start gap-4 lg:flex-row lg:gap-8 min-w-0">
        <DateRangeSelector />

        <div className="flex items-center gap-2 flex-none">
          <Tabs value={paidFilter}>
            <TabsList className="flex gap-2 overflow-x-auto whitespace-nowrap">
              <TabsTrigger value="all" onClick={() => setPaidFilter('all')}>
                {i18n.t('all') as TranslationKey}
              </TabsTrigger>
              <TabsTrigger value="unpaid" onClick={() => setPaidFilter('unpaid')}>
                {i18n.t('unpaid') as TranslationKey}
              </TabsTrigger>
              <TabsTrigger value="paid" onClick={() => setPaidFilter('paid')}>
                {i18n.t('paid') as TranslationKey}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
      {/* @ts-expect-error */}
      <DataTable columns={columns} data={[...(dataToTable || []), ...totalRow]} />
    </>
  );
}
