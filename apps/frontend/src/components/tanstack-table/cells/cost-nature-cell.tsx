import { TOTAL } from '@/constant.ts';
import { Badge } from '@/components/ui/badge.tsx';
import i18n from '@/i18n.ts';

type CostNatureCellProps = {
  id: string;
  survives: boolean;
};

/**
 * Whether this cost would still be there with no income coming in.
 *
 * Every cost has an answer — one it was given or one derived from its priority — so unlike a
 * priority there is no row with nothing to say here.
 *
 * Wears no colour, and the priority beside it does. Colour in this app means urgency, the
 * priority *is* urgency, and two filled chips in one row would make the same red mean "pay this
 * first" in one column and "this cannot be cut" in the next. The word is the whole answer.
 */
export default function CostNatureCell({ id, survives }: CostNatureCellProps) {
  if (id === TOTAL) {
    return null;
  }

  return (
    <Badge variant="outline" className="px-2 font-medium">
      {i18n.t(survives ? 'cost_nature.irreducible' : 'cost_nature.reducible')}
    </Badge>
  );
}
