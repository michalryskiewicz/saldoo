import type { MaybeConverted } from '@/lib/exchange-rate.ts';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { DataTable } from '@/components/ui/data-table.tsx';
import { Cell, Header } from '@/components/tanstack-table';
import { Button } from '@/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { TOTAL } from '@/constant.ts';
import i18n from '@/i18n.ts';
import { formatDate } from '@/lib/formats.ts';
import { deleteDBPosition, type DBPosition } from '@/database/positions.ts';
import { setPositionsDrawerId } from '@/store/preferences.slice.ts';
import { useNetWorth } from '@/features/net-worth/hooks/use-net-worth.tsx';

type PositionRow = MaybeConverted<DBPosition> & { totalLabel?: string };

const PositionActions = ({ id }: { id: string }) => {
  const dispatch = useDispatch();

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`${i18n.t('edit')} — ${id}`}
            onClick={() => dispatch(setPositionsDrawerId(id))}
          >
            <Pencil className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{i18n.t('edit')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`${i18n.t('remove')} — ${id}`}
            onClick={() => deleteDBPosition(id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{i18n.t('remove')}</TooltipContent>
      </Tooltip>
    </div>
  );
};

const columns: ColumnDef<PositionRow>[] = [
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
    accessorKey: 'kind',
    header: i18n.t('holdings.kind'),
    cell: ({ row }) =>
      row.original.id === TOTAL ? null : (
        <Cell.Tags tag={i18n.t(`holdings.${row.original.kind}`)} />
      ),
  },
  {
    accessorKey: 'value',
    meta: { mobile: 'figure' as const },
    // What is owed is shown as what it is rather than as a negative: the sign lives in the kind,
    // and printing "-18 000" beside a column already headed "I owe" says it twice.
    cell: ({ row }) => (
      <Cell.Money
        id={row.original.id}
        price={row.original.value}
        currency={row.original.currency}
        convertedFrom={row.original.convertedFrom}
      />
    ),
    header: ({ column }) => <Header.Sort column={column} header="holdings.value" />,
  },
  {
    accessorKey: 'valuedOn',
    header: i18n.t('holdings.valued_on'),
    cell: ({ row }) =>
      row.original.id === TOTAL ? null : (
        <Cell.Text id={row.original.id} name={formatDate(row.original.valuedOn)} />
      ),
  },
  {
    id: 'actions',
    meta: { mobile: 'actions' as const },
    header: () => <span className="sr-only">{i18n.t('open_menu')}</span>,
    cell: ({ row }) =>
      row.original.id === TOTAL ? null : <PositionActions id={row.original.id} />,
  },
];

export const PositionsTable = () => {
  const { positions, totals, currency } = useNetWorth();

  const totalRow: PositionRow[] = positions.length
    ? [
        {
          id: TOTAL,
          createdAt: new Date(),
          description: 'TOTAL',
          totalLabel: i18n.t('holdings.net_worth'),
          kind: 'asset',
          value: totals.net,
          currency,
          valuedOn: new Date(),
        },
      ]
    : [];

  return (
    <DataTable
      columns={columns}
      data={[...positions, ...totalRow]}
      emptyMessage={i18n.t('holdings.empty')}
    />
  );
};
