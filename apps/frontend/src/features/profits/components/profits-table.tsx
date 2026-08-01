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
import { useState } from 'react';

const columns: ColumnDef<DBProfit>[] = [
  {
    accessorKey: 'description',
    meta: { grow: true },
    cell: ({ row }) => <Cell.Description id={row.original.id} name={row.original.description} />,
    header: ({ column }) => <Header.Sort column={column} header="description" />,
  },
  {
    accessorKey: 'profit',
    meta: { mobile: 'figure' as const },
    cell: ({ row }) => {
      const { id, profit, currency } = row.original;
      return <Cell.Money id={id} price={profit} currency={currency} />;
    },
    header: ({ column }) => (
      <Header.Info column={column} header="profit" tooltip="price_exchanged_automatically" />
    ),
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

  // A summary row rather than a stored profit, so it is shaped like one on purpose.
  const totalRow = dataToTable.length
    ? [
        {
          id: TOTAL,
          description: 'TOTAL',
          profit: dataToTable.reduce((acc, curr) => acc + (curr.profit || 0), 0),
          currency: dataToTable[0].currency,
        } as DBProfit,
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
