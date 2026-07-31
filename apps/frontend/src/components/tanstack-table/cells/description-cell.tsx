import { TOTAL } from '@/constant.ts';
import i18n from '@/i18n.ts';

type DescriptionCellProps = {
  id: string;
  name: string;
};

export default function DescriptionCell({ id, name }: DescriptionCellProps) {
  if (id === TOTAL) {
    // A label for the band, in the heading's own type: the figure beside it is the thing worth
    // reading, and bold on both left them competing.
    return (
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {i18n.t('total')}
      </span>
    );
  }

  if (!name) {
    return null;
  }

  return name;
}
