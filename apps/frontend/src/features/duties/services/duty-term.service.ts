import { isSameDay, startOfDay } from 'date-fns';

/**
 * What a due date is currently saying — the one thing colour on this table is allowed to mean.
 *
 * `settled` is not a date at all: an occurrence that is paid or skipped wants nothing, so its
 * date stops being urgency and becomes history. Without it the row that needs no attention
 * would be the loudest one on screen.
 */
export type DutyTerm = 'overdue' | 'today' | 'upcoming' | 'settled';

type DutyTermState = {
  executionDate: Date;
  today: Date;
  resolved?: boolean;
  ignored?: boolean;
};

export function dutyTermState({
  executionDate,
  today,
  resolved,
  ignored,
}: DutyTermState): DutyTerm {
  if (resolved || ignored) return 'settled';
  if (isSameDay(executionDate, today)) return 'today';

  return startOfDay(executionDate) < startOfDay(today) ? 'overdue' : 'upcoming';
}

/**
 * How loudly a whole row should speak.
 *
 * Separate from the term because the row draws a distinction the date does not: paid and
 * skipped are both finished, but only one of them is a thing that will never happen. Skipping
 * wins over a tick, since an occurrence the user has called off is called off whatever was
 * marked on it earlier.
 */
export type DutyRowTone = 'due' | 'settled' | 'skipped';

export function dutyRowTone({
  resolved,
  ignored,
}: {
  resolved?: boolean;
  ignored?: boolean;
}): DutyRowTone {
  if (ignored) return 'skipped';

  return resolved ? 'settled' : 'due';
}
