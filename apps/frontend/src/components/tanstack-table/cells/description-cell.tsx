import { TOTAL } from '@/constant.ts';
import i18n from '@/i18n.ts';

type DescriptionCellProps = {
  id: string;
  name: string;
  /**
   * What the summary band is called, where "total" is not specific enough to be true.
   *
   * The duties table sums a different thing under each of its status tabs, so a single fixed
   * word is wrong under two of the three. Defaulted, so no other table changes.
   */
  totalLabel?: string;
};

export default function DescriptionCell({ id, name, totalLabel }: DescriptionCellProps) {
  if (id === TOTAL) {
    // A label for the band, in the heading's own type: the figure beside it is the thing worth
    // reading, and bold on both left them competing.
    return (
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {totalLabel ?? i18n.t('total')}
      </span>
    );
  }

  if (!name) {
    return null;
  }

  return name;
}
