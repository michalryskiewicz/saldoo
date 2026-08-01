import type { DBExpense } from '@/database/expenses.ts';
import type { DBDuty } from '@/database/duty.ts';
import { occurrencesInRange } from '@/lib/recurrence.ts';
import { FREQUENCY } from '@/constant.ts';
import { hashString } from '@/lib/helpers.ts';
import { differenceInCalendarDays } from 'date-fns';

type CreateDutiesForSelectedDateRange = {
  expenses: DBExpense[];
  startDate: Date;
  endDate: Date;
};

type SelectStaleDuties = {
  stored: DBDuty[];
  expectedHashes: Iterable<string>;
  from: Date;
  to: Date;
};

/**
 * Which stored duties the current expense definitions would no longer produce.
 *
 * A duty's identity is `hash(expenseId, frequency, executionDate)`, so the honest question is
 * not "did the frequency change" but "is this row still in the set the expenses generate" —
 * the former cannot see a moved execution day, which is how one expense came to own two
 * occurrences in the same month.
 *
 * Bounded at both ends. Duties for months nobody opened on this device arrive by sync (ADR
 * 0001), so a sweep scoped to one range must leave every row outside it alone; unbounded, a
 * top-up of the current month would delete a future month generated elsewhere.
 *
 * A duty the user has marked is never returned. `resolved` and `ignored` are decisions rather
 * than derived data (ADR 0001), so regeneration has no standing to destroy either — if an
 * expense moved after a payment was marked, both the payment and the new occurrence are true,
 * and the user settles that by skipping one.
 */
export function selectStaleDuties({ stored, expectedHashes, from, to }: SelectStaleDuties) {
  const expected = new Set(expectedHashes);

  return stored
    .filter((duty) => {
      const executionDate = new Date(duty.executionDate).getTime();
      const inRange = executionDate >= from.getTime() && executionDate <= to.getTime();

      return inRange && !expected.has(duty.hash) && !duty.resolved && !duty.ignored;
    })
    .map((duty) => duty.id);
}

/**
 * The identity of one occurrence.
 *
 * The interval joins it only when there is one to speak of. Every recurrence stored before
 * intervals existed means "every one", so an explicit 1 has to hash to what it hashed to
 * before — otherwise saying out loud what was already true would re-mint every occurrence in
 * the vault and strand the marks on them.
 */
async function generateDutyHash(
  executionDate: Date,
  expenseId: string,
  frequency: FREQUENCY,
  interval?: number
): Promise<string> {
  const cadence = interval && interval > 1 ? `${frequency}x${interval}` : frequency;

  return hashString(`${expenseId}_${cadence}_${executionDate.toISOString()}`);
}

type CreateDutiesForSelectedDateRangeResp = Pick<
  DBDuty,
  'executionDate' | 'expenseId' | 'frequency' | 'hash'
>;

type DutyMarks = Pick<DBDuty, 'resolved' | 'ignored' | 'transactionId' | 'rejectedTransactionIds'>;

type CarriedMark = { staleId: string; hash: string; marks: DutyMarks };

type CarryMarksToMovedOccurrences = {
  stored: DBDuty[];
  expected: CreateDutiesForSelectedDateRangeResp[];
};

/**
 * Marks that belong to an occurrence the app has re-dated, and where they now belong.
 *
 * Daily occurrences were minted a day early — their dates round-tripped through `toISOString`,
 * which moves local midnight into the previous day anywhere east of UTC. The correction moves
 * every one of them, and the date is the identity, so without this a paid day would be left
 * behind under its old date while its correct row appeared beside it unmarked.
 *
 * Narrow on purpose: daily only, exactly one day, and only onto an occurrence that has no row
 * of its own yet. A monthly cost the *user* moved by a day is a different event — there both
 * the payment and the new occurrence are true, and they settle it by skipping one (ADR 0001).
 * This is the app correcting its own arithmetic, where nothing in the person's data moved.
 */
export function carryMarksToMovedOccurrences({
  stored,
  expected,
}: CarryMarksToMovedOccurrences): CarriedMark[] {
  const storedHashes = new Set(stored.map((duty) => duty.hash));
  const unclaimed = expected.filter(
    (occurrence) => occurrence.frequency === FREQUENCY.DAILY && !storedHashes.has(occurrence.hash)
  );
  const claimed = new Set<string>();

  return stored.flatMap((duty) => {
    const isMarked = duty.resolved || duty.ignored;
    const wasDroppedByTheCorrection =
      duty.frequency === FREQUENCY.DAILY && !expected.some(({ hash }) => hash === duty.hash);

    if (!isMarked || !wasDroppedByTheCorrection) return [];

    const movedTo = unclaimed.find(
      (occurrence) =>
        occurrence.expenseId === duty.expenseId &&
        !claimed.has(occurrence.hash) &&
        // Calendar days, not hours. The old date is UTC midnight and the new one local
        // midnight, so the gap is 22 hours in summer and 23 in winter — never 24.
        differenceInCalendarDays(
          new Date(occurrence.executionDate),
          new Date(duty.executionDate)
        ) === 1
    );

    if (!movedTo) return [];

    claimed.add(movedTo.hash);

    return [
      {
        staleId: duty.id,
        hash: movedTo.hash,
        marks: {
          resolved: duty.resolved,
          ignored: duty.ignored,
          transactionId: duty.transactionId,
          rejectedTransactionIds: duty.rejectedTransactionIds,
        },
      },
    ];
  });
}

/**
 * The occurrences of every expense that fall inside a range, as duties.
 *
 * The dates come from `occurrencesInRange` — the same rule the money totals are counted with.
 * They used to come from a date walker written here, four branches deep, and the two answers
 * drifted: a yearly cost entered on a leap day produced no occurrence at all in a February it
 * was nonetheless charged for, and the daily branch round-tripped its dates through
 * `toISOString`, which moves local midnight into the previous day anywhere east of UTC.
 */
export async function createDutiesForSelectedDateRange({
  expenses,
  startDate,
  endDate,
}: CreateDutiesForSelectedDateRange) {
  const duties: CreateDutiesForSelectedDateRangeResp[] = [];

  for (const expense of expenses) {
    if (!expense.frequency) continue;

    for (const executionDate of occurrencesInRange(expense, { from: startDate, to: endDate })) {
      duties.push({
        executionDate,
        expenseId: expense.id,
        frequency: expense.frequency,
        hash: await generateDutyHash(
          executionDate,
          expense.id,
          expense.frequency,
          expense.interval
        ),
      });
    }
  }

  return duties;
}
