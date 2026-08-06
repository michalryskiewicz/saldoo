import { CreditCard, List, PenLine, Square, SquareCheck } from 'lucide-react';
import { TableSearch } from '@/components/ui/table-search.tsx';
import { searchDuties } from '@/features/duties/services/duties-search.service.ts';
import { type DutyRowTone, dutyRowTone } from '@/features/duties/services/duty-term.service.ts';
import { DataTable } from '@/components/ui/data-table.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import DateRangeSelector, {
  type DateRange,
} from '@/features/duties/components/date-range-selector.tsx';
import i18n, { type TranslationKey } from '@/i18n.ts';
import type { ColumnDef } from '@tanstack/react-table';
import { Cell, Header } from '@/components/tanstack-table';
import { TOTAL, type Currency } from '@/constant.ts';
import DutiesTableActions from '@/features/duties/components/duties-table-actions.tsx';
import DutyTermCell from '@/features/duties/components/duty-term-cell.tsx';
import { dutiesEmptyReason } from '@/features/duties/services/duties-empty.service.ts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useDuties } from '@/features/duties/hooks/use-duties.tsx';
import { type DBDuty, resolveDBDuty } from '@/database/duty.ts';
import type { DBExpense } from '@/database/expenses.ts';
import { survivesIncomeLoss } from '@/lib/safety-net.ts';
import { useState } from 'react';
import { endOfMonth, startOfMonth } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import {
  type DutyStatus,
  selectVisibleDuties,
  sumPayableDuties,
} from '@/features/duties/services/duties-filter.service.ts';

/**
 * The status tabs, wearing the checkbox they filter by: an empty box for what is still owed, a
 * ticked one for what is paid. The row already answers "was this paid" with a checkbox, so the
 * filter that selects on it should look like the thing it selects — the card and pen in the row
 * answer a different question (how it was paid) and keep their own glyphs.
 */
const STATUS_TABS = [
  { value: 'all', icon: List, label: 'all' },
  { value: 'unpaid', icon: Square, label: 'unpaid' },
  { value: 'paid', icon: SquareCheck, label: 'paid' },
] as const;

/**
 * A row as this table sees it: an occurrence with the expense that produced it joined in.
 *
 * `totalLabel` rides on the summary row rather than being read from the filter by the column
 * definitions, which are module-level and know nothing about state. Carrying it as data keeps
 * the columns a constant — rebuilt per render they would reset the table's own sorting.
 */
export type DutyRow = DBDuty & {
  expense: DBExpense;
  price: number;
  currency: Currency;
  totalLabel?: string;
};

/**
 * Struck out rather than merely quiet for a skipped occurrence: dimming alone reads as
 * "disabled", and this one is not unavailable — it is a line the user has crossed off.
 */
const ROW_TONE: Record<DutyRowTone, string | undefined> = {
  due: undefined,
  // The priority badge carries its own fill, so dimming the row's text leaves it shouting on the
  // one line that wants nothing. It keeps its colour -- the same fill the priority chart uses --
  // and loses only its insistence.
  settled: 'text-muted-foreground [&_[data-slot=badge]]:opacity-60',
  skipped: 'text-muted-foreground line-through [&_[data-slot=badge]]:opacity-60',
};

const columns: ColumnDef<DutyRow>[] = [
  {
    accessorKey: 'expense.description',
    meta: { grow: true },
    cell: ({ row }) => {
      const { id, expense, totalLabel } = row.original;

      if (id === TOTAL) {
        return <Cell.Description id={id} name={expense.description} totalLabel={totalLabel} />;
      }

      return <Cell.Description id={id} name={expense.description} opensExpenseId={expense.id} />;
    },
    header: ({ column }) => <Header.Sort column={column} header="description" />,
  },
  {
    accessorKey: 'expense',
    meta: { mobile: 'figure' as const },
    header: i18n.t('expense'),
    // The row's own price and currency, not the cost's. A share of an income has no amount on its
    // record, and a converted figure cannot live nested inside the cost it came from.
    cell: ({ row }) => (
      <Cell.Money
        id={row.original.expense.id}
        price={row.original.price}
        currency={row.original.currency}
      />
    ),
  },
  {
    id: 'survivesIncomeLoss',
    accessorFn: (row) => survivesIncomeLoss(row.expense),
    header: ({ column }) => <Header.Sort column={column} header="cost_nature.column" />,
    cell: ({ row }) => (
      <Cell.CostNature
        id={row.original.expense.id}
        survives={survivesIncomeLoss(row.original.expense)}
      />
    ),
  },
  {
    accessorKey: 'executionDate',
    header: ({ column }) => <Header.Sort column={column} header="due_date" />,
    cell: ({ row }) => {
      const { id, executionDate, resolved, ignored } = row.original;
      return (
        <DutyTermCell
          id={id}
          executionDate={new Date(executionDate)}
          resolved={resolved}
          ignored={ignored}
        />
      );
    },
  },
  {
    id: 'select',
    meta: { align: 'center' as const, mobile: 'actions' as const },
    accessorKey: 'resolved',
    header: i18n.t('resolved'),
    cell: ({ row }) => {
      const { id, resolved, transactionId, ignored } = row.original;
      // Nothing was paid and nothing is owed on an occurrence that will not happen.
      if (id === TOTAL || ignored) return null;

      // A card for a payment there is a transaction behind, a pen for one the user asserted:
      // the distinction is evidence versus claim. Not a hand -- at 16px it reads as "stop".
      const Indicator = resolved ? (transactionId ? CreditCard : PenLine) : null;
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
          {Indicator && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground leading-none" aria-label={indicatorTitle}>
                  <Indicator className="size-3.5" aria-hidden="true" />
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
    meta: { mobile: 'actions' as const },
    // `size`, not `maxSize`: the table reads the former. With only `maxSize` set this column
    // took an equal share of the width and parked the icon far from its row.
    header: () => <span className="sr-only">{i18n.t('open_menu')}</span>,
    cell: ({ row }) => {
      if (row.original.id === TOTAL) {
        return null;
      }
      return (
        <div className="flex items-center justify-end">
          <DutiesTableActions dutyId={row.original.id} ignored={!!row.original.ignored} />
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
  const { duties, currency } = useDuties(range);
  // Whether anything could be generated at all, which is what tells "you have no expenses" apart
  // from "nothing falls due this month" — two empties that look identical and lead elsewhere.
  const expenseCount = useLiveQuery(() => db.expenses.count(), []);
  const [paidFilter, setPaidFilter] = useState<DutyStatus>('all');
  const [query, setQuery] = useState('');

  // Filtered before the table sees it, so the summary totals what is on the screen rather than
  // what the month happens to hold.
  const dataToTable = searchDuties(selectVisibleDuties(duties ?? [], paidFilter), query);

  const emptyReason = dutiesEmptyReason({
    hasExpenses: (expenseCount ?? 0) > 0,
    dutiesInRange: duties?.length ?? 0,
    visibleRows: dataToTable.length,
  });

  const emptyMessage = query
    ? i18n.t('table.no_search_results', { query })
    : emptyReason
      ? i18n.t(`duties_empty.${emptyReason.replace('-', '_')}` as TranslationKey)
      : undefined;

  const totalRow = dataToTable.length
    ? [
        {
          id: TOTAL,
          resolved: false,
          transactionId: undefined,
          // What the figure beside it is a total *of*. It differs per tab: under "unpaid" the
          // sum is what is still owed, not what the period holds, and one fixed word would be
          // wrong under two of the three.
          totalLabel: i18n.t(`duties_total.${paidFilter}` as TranslationKey),
          // The screen's currency, not the first row's. Every row is converted into it by the
          // time the sum happens, and borrowing whichever currency happened to sort first put a
          // złoty label on a figure that was part euro.
          price: sumPayableDuties(dataToTable),
          currency,
          expense: {
            id: TOTAL,
            description: 'TOTAL',
            expense: sumPayableDuties(dataToTable),
            currency,
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
      columns={columns}
      data={[...dataToTable, ...totalRow] as DutyRow[]}
      // A list of things falling due reads by date or it reads as nothing.
      initialSorting={[{ id: 'executionDate', desc: false }]}
      rowClassName={(row) => ROW_TONE[dutyRowTone(row)]}
      emptyMessage={emptyMessage}
    >
      {() => (
        <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          {/* First on a phone: of the three controls it is the one that narrows the list fastest. */}
          <div className="order-first w-full lg:order-last lg:ml-auto lg:w-auto">
            <TableSearch value={query} onChange={setQuery} />
          </div>

          <div className="flex min-w-0 items-center gap-2 lg:gap-6">
            <DateRangeSelector value={range} onChange={setRange} />

            <Tabs value={paidFilter} onValueChange={(value) => setPaidFilter(value as DutyStatus)}>
              <TabsList className="flex gap-1 overflow-x-auto whitespace-nowrap">
                {STATUS_TABS.map(({ value, icon: Icon, label }) => (
                  <TabsTrigger key={value} value={value} aria-label={i18n.t(label)}>
                    <Icon className="size-4" aria-hidden="true" />
                    {/* The word is kept where there is room for it: two of these glyphs echo the
                        checkbox in the rows and read on their own, but nothing pictures "all". */}
                    <span className="hidden md:inline">{i18n.t(label)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
      )}
    </DataTable>
  );
}
