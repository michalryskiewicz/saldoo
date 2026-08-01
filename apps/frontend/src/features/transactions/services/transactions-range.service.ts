import { endOfMonth, isWithinInterval, startOfMonth, subMonths } from 'date-fns';

/** The periods the table offers. `all` is the absence of a period rather than one of them. */
export type TransactionRange = 'all' | 'this-month' | 'previous-month';

type DatedTransaction = { transactionDate: string };

/**
 * The payments booked inside the chosen period.
 *
 * `today` is a parameter rather than a call to the clock, so "this month" can be tested without
 * the answer changing at midnight on the last of the month.
 *
 * A payment with no date is left out of a period and kept under "everything": it is still a
 * payment, and there is no honest month to file it under.
 */
export const selectTransactionsInRange = <TRow extends DatedTransaction>(
  rows: TRow[],
  range: TransactionRange,
  today: Date
): TRow[] => {
  if (range === 'all') return rows;

  const month = range === 'this-month' ? today : subMonths(today, 1);
  // `endOfMonth`, not the first of the next: the last day's payments are in the month they were
  // booked in, and a boundary read as midnight drops all of them.
  const interval = { start: startOfMonth(month), end: endOfMonth(month) };

  return rows.filter(
    (row) => !!row.transactionDate && isWithinInterval(new Date(row.transactionDate), interval)
  );
};
