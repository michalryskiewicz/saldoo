import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
import { DataTable } from '@/components/ui/data-table.tsx';
import { Cell, Header } from '@/components/tanstack-table';
import { Button } from '@/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { TOTAL } from '@/constant.ts';
import i18n from '@/i18n.ts';
import { formatDate } from '@/lib/formats.ts';
import { db } from '@/database';
import { deleteDBBond, type DBBondHolding } from '@/database/bonds.ts';
import { setBondsDrawerId } from '@/store/preferences.slice.ts';
import { bondValueOn } from '@/features/net-worth/services/bond-accrual.service.ts';

type BondRow = DBBondHolding & {
  totalLabel?: string;
  /** Worked out rather than stored — see `bond-accrual.service`. */
  worth: number;
  earned: number;
};

const BondActions = ({ id, name }: { id: string; name: string }) => {
  const dispatch = useDispatch();

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`${i18n.t('edit')} — ${name}`}
            onClick={() => dispatch(setBondsDrawerId(id))}
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
            aria-label={`${i18n.t('remove')} — ${name}`}
            onClick={() => deleteDBBond(id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{i18n.t('remove')}</TooltipContent>
      </Tooltip>
    </div>
  );
};

const columns: ColumnDef<BondRow>[] = [
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
    header: ({ column }) => <Header.Sort column={column} header="bonds.series" />,
  },
  {
    accessorKey: 'quantity',
    header: i18n.t('bonds.quantity'),
    cell: ({ row }) =>
      row.original.id === TOTAL ? null : (
        <Cell.Text id={row.original.id} name={String(row.original.quantity)} />
      ),
  },
  {
    accessorKey: 'boughtOn',
    header: i18n.t('bonds.bought_on'),
    cell: ({ row }) =>
      row.original.id === TOTAL ? null : (
        <Cell.Text id={row.original.id} name={formatDate(row.original.boughtOn)} />
      ),
  },
  {
    id: 'earned',
    // Named for where the money went rather than for one word covering both: interest that joined
    // the capital and interest that was paid out are not the same thing to anybody.
    header: i18n.t('bonds.accrued'),
    accessorFn: (row) => row.earned,
    cell: ({ row }) => (
      <Cell.Money
        id={row.original.id}
        price={row.original.earned}
        currency={row.original.currency}
      />
    ),
  },
  {
    id: 'worth',
    meta: { mobile: 'figure' as const },
    accessorFn: (row) => row.worth,
    cell: ({ row }) => (
      <Cell.Money
        id={row.original.id}
        price={row.original.worth}
        currency={row.original.currency}
      />
    ),
    header: ({ column }) => <Header.Sort column={column} header="bonds.value" />,
  },
  {
    id: 'actions',
    meta: { mobile: 'actions' as const },
    header: () => <span className="sr-only">{i18n.t('open_menu')}</span>,
    cell: ({ row }) =>
      row.original.id === TOTAL ? null : (
        <BondActions id={row.original.id} name={row.original.description} />
      ),
  },
];

export const BondsTable = () => {
  const bonds = useLiveQuery(() => db.bonds.toArray(), []) || [];
  const today = new Date();

  const rows: BondRow[] = bonds.map((bond) => {
    const { value, accrued, paidOut } = bondValueOn(bond, today);

    return { ...bond, worth: value, earned: accrued + paidOut };
  });

  const totalRow: BondRow[] = rows.length
    ? [
        {
          ...rows[0],
          id: TOTAL,
          description: 'TOTAL',
          totalLabel: i18n.t('total'),
          worth: Number(rows.reduce((total, row) => total + row.worth, 0).toFixed(2)),
          earned: Number(rows.reduce((total, row) => total + row.earned, 0).toFixed(2)),
        },
      ]
    : [];

  return (
    <DataTable columns={columns} data={[...rows, ...totalRow]} emptyMessage={i18n.t('bonds.empty')} />
  );
};
