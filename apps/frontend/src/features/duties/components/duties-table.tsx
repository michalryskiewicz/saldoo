import { DataTable } from '@/components/ui/data-table.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import DateRangeSelector, {
  type DateRange,
} from '@/features/duties/components/date-range-selector.tsx';
import i18n, { type TranslationKey } from '@/i18n.ts';
import { formatRecurrence } from '@/lib/formats.ts';
import type { ColumnDef } from '@tanstack/react-table';
import { Cell, Header } from '@/components/tanstack-table';
import { TOTAL } from '@/constant.ts';
import DutiesTableActions from '@/features/duties/components/duties-table-actions.tsx';
import { useDuties } from '@/features/duties/hooks/use-duties.tsx';
import { type DBDuty, resolveDBDuty } from '@/database/duty.ts';
import type { DBExpense } from '@/database/expenses.ts';
import { useState } from 'react';
import { endOfMonth, startOfMonth } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';

const columns: ColumnDef<DBDuty & { expense: DBExpense }>[] = [
  {
    accessorKey: 'expense.description',
    meta: { grow: true },
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
    accessorKey: 'expense.frequency',
    header: i18n.t('frequency'),
    cell: ({ row }) => {
      const { id, execution, frequency } = row.original.expense;
      return <Cell.Text id={id} name={formatRecurrence(execution, frequency)} />;
    },
  },
  {
    id: 'select',
    meta: { align: 'center' as const },
    accessorKey: 'resolved',
    header: i18n.t('resolved'),
    cell: ({ row }) => {
      const { id, resolved, transactionId } = row.original;
      if (id === TOTAL) return null;

      const indicator = resolved ? (transactionId ? '💳' : '🖐') : null;
      const indicatorTitle = transactionId
        ? i18n.t('resolved_via_transaction')
        : i18n.t('resolved_manually');

      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={resolved}
            onCheckedChange={() => resolveDBDuty(id, !resolved)}
            aria-label={i18n.t('resolved')}
          />
          {indicator && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-base leading-none" aria-label={indicatorTitle}>
                  {indicator}
                </span>
              </TooltipTrigger>
              <TooltipContent>{indicatorTitle}</TooltipContent>
            </Tooltip>
          )}
        </div>
      );
    },
  },
  {
    id: 'actions',
    // `size`, not `maxSize`: the table reads the former. With only `maxSize` set this column
    // took an equal share of the width and parked the icon far from its row.
    header: () => <span className="sr-only">{i18n.t('open_menu')}</span>,
    cell: ({ row }) => {
      if (row.original.id === TOTAL) {
        return null;
      }
      return (
        <div className="flex items-center justify-end">
          <DutiesTableActions dutyId={row.original.id} />
        </div>
      );
    },
  },
];

export default function DutiesTable() {
  const [range, setRange] = useState<DateRange>(() => {
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  });
  const { duties } = useDuties(range);
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
    <DataTable
      // @ts-expect-error the duty row carries a nullable expense the column defs narrow themselves
      columns={columns}
      data={[...(dataToTable || []), ...totalRow]}
    >
      {() => (
        <>
          <div className="flex flex-col w-full justify-start gap-4 lg:flex-row lg:gap-8 min-w-0">
            <DateRangeSelector value={range} onChange={setRange} />

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
        </>
      )}
    </DataTable>
  );
}
