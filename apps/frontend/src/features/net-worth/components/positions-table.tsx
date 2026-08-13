import type { MaybeConverted } from '@/lib/exchange-rate.ts';
import type { ValuationChange } from '@/features/net-worth/services/valuation-history.service.ts';
import type { PaidInAndGrown } from '@/features/net-worth/services/paid-in-and-grown.service.ts';
import { formatMoney } from '@/lib/formats.ts';
import { cn } from '@/lib/utils.ts';
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

type PositionRow = MaybeConverted<DBPosition> & {
  totalLabel?: string;
  /** What it has done since the reading before its latest — absent while it has only one. */
  change?: ValuationChange;
  /** What went in by hand against what it earned — absent where the arrangement does not say. */
  split?: PaidInAndGrown;
};

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
    id: 'change',
    // What a stored value cannot say on its own: 31 500 is a number, and up 1 500 is what happened.
    // Empty on a holding valued only once — nought there would claim it had not moved, when the
    // truth is that there is nothing yet to have moved from.
    accessorFn: (row) => row.change?.amount ?? 0,
    cell: ({ row }) => {
      const { change } = row.original;

      if (row.original.id === TOTAL || !change) return null;

      return (
        <Cell.Money
          id={row.original.id}
          price={change.amount}
          currency={change.currency}
          directional
        />
      );
    },
    header: ({ column }) => (
      <Header.Info column={column} header="holdings.change" tooltip="holdings.change_tooltip" />
    ),
  },
  {
    id: 'grown',
    // Both facts in one cell rather than two columns: they are one sentence about the holding, and
    // the earned figure is meaningless without the figure it is measured against.
    accessorFn: (row) => row.split?.grown ?? 0,
    cell: ({ row }) => {
      const { split } = row.original;

      if (row.original.id === TOTAL || !split) return null;

      return (
        <div className="flex flex-col items-end whitespace-nowrap">
          <span className={cn('tabular-nums', { 'text-positive': split.grown > 0 })}>
            {formatMoney(split.grown, split.currency, 'pl')}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {i18n.t('holdings.paid_in', {
              amount: formatMoney(split.paidIn, split.currency, 'pl'),
            })}
          </span>
        </div>
      );
    },
    header: ({ column }) => (
      <Header.Info column={column} header="holdings.grown" tooltip="holdings.grown_tooltip" />
    ),
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
