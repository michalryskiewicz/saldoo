import { TOTAL } from '@/constant.ts';
import { formatDueDate } from '@/lib/formats.ts';
import { cn } from '@/lib/utils.ts';
import { type DutyTerm, dutyTermState } from '@/features/duties/services/duty-term.service.ts';

/**
 * Both tokens are already held to 4.5:1 against the card in `contrast.e2e.ts`, in both themes,
 * so this reuses the vocabulary the app already guards rather than minting a shade the test
 * has never seen. The severity fills are deliberately not reused: they are pastel, and pastel
 * as *text* fails the same test.
 */
const TONE: Record<DutyTerm, string> = {
  overdue: 'text-destructive font-medium',
  today: 'text-warning font-medium',
  upcoming: '',
  settled: 'text-muted-foreground',
};

type DutyTermCellProps = {
  id: string;
  executionDate: Date;
  resolved?: boolean;
  ignored?: boolean;
};

/**
 * When an occurrence falls due, and the only thing colour on this table means.
 *
 * The column it replaces said how often the expense recurs — a fact about the definition, not
 * about the row. With every occurrence of one expense carrying the same description and the
 * same phrase, the rows were indistinguishable from each other; the date is what tells them
 * apart, and it is also what makes the list orderable at all.
 */
export default function DutyTermCell({ id, executionDate, resolved, ignored }: DutyTermCellProps) {
  if (id === TOTAL) return null;

  // Read per render rather than held: a tab left open across midnight would go on calling
  // yesterday "today".
  const today = new Date();

  return (
    <p className={cn(TONE[dutyTermState({ executionDate, today, resolved, ignored })])}>
      {formatDueDate(executionDate, today)}
    </p>
  );
}
