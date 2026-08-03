import { TOTAL } from '@/constant.ts';
import { cn } from '@/lib/utils.ts';
import { Badge } from '@/components/ui/badge.tsx';
import i18n from '@/i18n.ts';

type CostNatureCellProps = {
  id: string;
  survives: boolean;
};

/**
 * Whether this cost would still be there with no income coming in.
 *
 * Every cost has an answer — one it was given or one derived from the priority it used to carry —
 * so unlike the priority this replaced there is no row with nothing to say. Filled with the same
 * colours the chart uses, so the table and the graph read as one fact rather than two.
 */
export default function CostNatureCell({ id, survives }: CostNatureCellProps) {
  if (id === TOTAL) {
    return null;
  }

  return (
    <Badge
      className={cn('text-cost-fill-foreground border-transparent px-2 font-medium', {
        'bg-cost-irreducible-fill': survives,
        'bg-cost-reducible-fill': !survives,
      })}
    >
      {i18n.t(survives ? 'cost_nature.irreducible' : 'cost_nature.reducible')}
    </Badge>
  );
}
