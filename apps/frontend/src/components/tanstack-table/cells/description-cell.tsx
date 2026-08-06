import { useDispatch } from 'react-redux';
import { TOTAL } from '@/constant.ts';
import i18n from '@/i18n.ts';
import { setExpensesDrawerId } from '@/store/preferences.slice.ts';

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
  /**
   * The expense this row leads to, when it leads anywhere.
   *
   * For an expense that is the row's own id; for an occurrence it is the definition behind it,
   * because the only edit an occurrence has is an edit to its expense — its amount and its date
   * both live there and the occurrence carries nothing but the user's marks.
   *
   * A row action menu already reaches the same drawer. That is a shortcut rather than a conflict:
   * the name is what a person looks at and points at, and the menu is where they go when they have
   * not found what they wanted.
   */
  opensExpenseId?: string;
};

export default function DescriptionCell({
  id,
  name,
  totalLabel,
  opensExpenseId,
}: DescriptionCellProps) {
  const dispatch = useDispatch();

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

  if (!opensExpenseId) {
    return name;
  }

  // Expect the row to move underneath on the duties screen: changing how often an expense recurs
  // regenerates the range, and the row clicked from may not be in the new set.
  return (
    <button
      type="button"
      className="text-left underline-offset-4 hover:underline"
      onClick={() => dispatch(setExpensesDrawerId(opensExpenseId))}
    >
      {name}
    </button>
  );
}
