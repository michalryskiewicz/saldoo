import { Badge } from '@/components/ui/badge.tsx';
import type { TransactionAssignment } from '@/features/transactions/services/transactions-assignment.service.ts';

type TransactionAssignmentCellProps = {
  assignments: TransactionAssignment[];
};

/**
 * Where a payment has been filed, as badges in one column.
 *
 * Each carries the name of what it answers in its `title`: three outline badges look alike, and
 * "JEDZENIE · Potrzeby · Zakupy spożywcze" reads as a list of three unrelated words until you
 * know which column each used to be in.
 */
export default function TransactionAssignmentCell({
  assignments,
}: TransactionAssignmentCellProps) {
  if (!assignments.length) {
    return null;
  }

  return (
    // One line in the table, wrapped on a phone. Allowed to wrap in a table, the column shrinks
    // to its widest badge and stacks the three of them, turning a filed payment into a row three
    // times the height of its neighbours; refusing makes the column ask for the width it needs,
    // which the growing column gives up. A phone has no column to take width from and its card
    // has the height to spare, so there a long filing wraps rather than running off the edge.
    <div className="inline-flex flex-wrap items-center justify-end gap-1.5 md:flex-nowrap">
      {assignments.map(({ label, value }) => (
        <Badge key={label} variant="outline" className="text-muted-foreground px-1.5" title={label}>
          {value}
        </Badge>
      ))}
    </div>
  );
}
