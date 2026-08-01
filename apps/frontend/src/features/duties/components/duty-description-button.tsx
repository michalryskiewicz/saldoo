import { useDispatch } from 'react-redux';
import { setExpensesDrawerId } from '@/store/preferences.slice.ts';

type DutyDescriptionButtonProps = {
  expenseId: string;
  name: string;
};

/**
 * The row's name, opening the expense it came from.
 *
 * The only edit an occurrence has is an edit to its definition: its amount and its date both
 * belong to the expense, and the occurrence itself carries nothing but the user's marks. So the
 * description leads where the change actually lives — and it puts the recurrence one click away
 * again, which the term column stopped showing.
 *
 * Expect the row to move underneath: changing how often the expense recurs regenerates the
 * range, and the row clicked from may not be in the new set.
 */
export default function DutyDescriptionButton({ expenseId, name }: DutyDescriptionButtonProps) {
  const dispatch = useDispatch();

  return (
    <button
      type="button"
      className="text-left underline-offset-4 hover:underline"
      onClick={() => dispatch(setExpensesDrawerId(expenseId))}
    >
      {name}
    </button>
  );
}
