import { DataTable } from '@/components/ui/data-table.tsx';
import { TableSearch } from '@/components/ui/table-search.tsx';
import { searchProfits } from '@/features/profits/services/profits-search.service.ts';
import { TOTAL } from '@/constant.ts';
import i18n from '@/i18n.ts';
import { formatRecurrence } from '@/lib/formats.ts';
import { Cell, Header } from '@/components/tanstack-table';
import ProfitsTableActions from '@/features/profits/components/profits-table-actions.tsx';
import type { ColumnDef } from '@tanstack/react-table';
import { useListProfits } from '@/features/profits/hooks/use-list-profits.tsx';
import type { DBProfit } from '@/database/profits.ts';
import { costInYear } from '@/lib/recurrence.ts';
import { useState } from 'react';

/**
 * A row as the table sees it.
 *
 * `totalLabel` rides on the summary row rather than being read from state by the column
 * definitions, which are module-level and know nothing about it.
 */
export type ProfitRow = DBProfit & { totalLabel?: string };

const columns: ColumnDef<ProfitRow>[] = [
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
    accessorKey: 'profit',
    // Blank on the summary, as on the expenses table: the amount as entered belongs to one plan,
    // and plans of different frequencies have no shared amount to add up.
    cell: ({ row }) => {
      const { id, profit, currency } = row.original;

      if (id === TOTAL) return null;

      return <Cell.Money id={id} price={profit} currency={currency} />;
    },
    header: ({ column }) => (
      <Header.Info column={column} header="profit" tooltip="price_exchanged_automatically" />
    ),
  },
  {
    id: 'yearlyIncome',
    // The figure on a phone, and the one the summary adds: the only column here whose rows are
    // comparable with each other. A monthly salary and a yearly commission cannot be ranked in
    // any shorter window.
    meta: { mobile: 'figure' as const },
    accessorFn: (row) =>
      row.id === TOTAL ? row.profit : costInYear(row, row.profit, new Date().getFullYear()),
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
    accessorKey: 'frequency',
    header: i18n.t('frequency'),
    cell: ({ row }) => {
      const { id, execution, frequency } = row.original;
      return <Cell.Text id={id} name={formatRecurrence(execution, frequency)} />;
    },
  },
  {
    id: 'actions',
    meta: { mobile: 'actions' as const },
    header: () => <span className="sr-only">{i18n.t('open_menu')}</span>,
    cell: ({ row }) => {
      if (row.original.id === TOTAL) {
        return null;
      }
      return (
        <div className="flex items-center justify-end">
          <ProfitsTableActions profitId={row.original.id} />
        </div>
      );
    },
  },
];

export default function ProfitsTable() {
  const { allProfits } = useListProfits();
  const [query, setQuery] = useState('');

  // Filtered before the table sees it, so the summary is a total of what is on the screen. Were
  // the search inside the table, the rows would narrow and the total would go on reporting the
  // sum of everything -- a figure that answers a question nobody asked.
  const dataToTable = searchProfits(allProfits ?? [], query);

  // A summary row rather than a stored profit, so it is shaped like one on purpose. Totalled
  // over a year for the same reason the expenses table is: a monthly figure added to a yearly
  // one is not a sum of anything.
  const year = new Date().getFullYear();
  const totalRow = dataToTable.length
    ? [
        {
          id: TOTAL,
          description: 'TOTAL',
          totalLabel: i18n.t('total_yearly'),
          profit: dataToTable.reduce((total, row) => total + costInYear(row, row.profit, year), 0),
          currency: dataToTable[0].currency,
        } as ProfitRow,
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
}
