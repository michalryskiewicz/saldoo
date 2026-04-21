import { DataTable } from '@/components/ui/data-table.tsx';
import { TOTAL } from '@/constant.ts';
import i18n from '@/i18n.ts';
import { formatFrequency } from '@/lib/formats.ts';
import { Cell, Header } from '@/components/tanstack-table';
import ProfitsTableActions from '@/features/profits/components/profits-table-actions.tsx';
import type { ColumnDef } from '@tanstack/react-table';
import { useListProfits } from '@/features/profits/hooks/use-list-profits.tsx';
import type { DBProfit } from '@/database/profits.ts';

const columns: ColumnDef<DBProfit>[] = [
  {
    accessorKey: 'description',
    cell: ({ row }) => <Cell.Description id={row.original.id} name={row.original.description} />,
    header: ({ column }) => <Header.Sort column={column} header="description" />,
  },
  {
    accessorKey: 'profit',
    cell: ({ row }) => {
      const { id, profit, currency } = row.original;
      return <Cell.Money id={id} price={profit} currency={currency} />;
    },
    header: ({ column }) => (
      <Header.Info column={column} header="profit" tooltip="price_exchanged_automatically" />
    ),
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
    header: i18n.t('frequency'),
    cell: ({ row }) => {
      const { id, frequency } = row.original;
      return <Cell.Frequency id={id} frequency={frequency} />;
    },
  },
  {
    id: 'actions',
    maxSize: 30,
    cell: ({ row }) => {
      if (row.original.id === TOTAL) {
        return null;
      }
      return <ProfitsTableActions row={row} />;
    },
  },
];

export default function ProfitsTable() {
  const { allProfits } = useListProfits();

  const dataToTable = allProfits ?? [];

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

  return <DataTable columns={columns} data={[...dataToTable, ...totalRow]} />;
}
