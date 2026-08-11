import { differenceInCalendarMonths, startOfMonth } from 'date-fns';
import type { DBTransaction } from '@/database/transactions.ts';
import type { DBContribution } from '@/database/contributions.ts';

/** How far back the app looks to judge what somebody actually manages. */
const MONTHS_OF_HISTORY = 6;

/** Below this there is no ordinary month to speak of, only a couple of months. */
const MONTHS_BEFORE_AN_ANSWER = 3;

export type MonthLeftover = {
  year: number;
  monthIndex: number;
  /** What the month ended with: everything in, less everything out. */
  leftover: number;
};

type CapacityInput = {
  transactions: DBTransaction[];
  contributions: DBContribution[];
  today: Date;
};

const monthKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}`;

const withinWindow = (day: Date, today: Date): boolean => {
  const months = differenceInCalendarMonths(startOfMonth(today), startOfMonth(day));

  // The month in progress is not a month: half of it has not happened, and counting it would drag
  // every answer down for no reason but the date.
  return months >= 1 && months <= MONTHS_OF_HISTORY;
};

/**
 * What each of the last complete months actually left over.
 *
 * Read from the statement rather than from the plan, because the question this answers is what
 * somebody manages, not what they meant to manage.
 *
 * **Money put aside is added back.** A transfer to savings leaves the account like any other
 * payment and a statement cannot tell the two apart, so without this the app would read somebody's
 * saving as evidence that they cannot save. Only what a statement confirmed: a declaration with no
 * payment behind it has no outflow to cancel, and adding it would credit a month with money that
 * never moved.
 *
 * **A month with nothing in it is absent, not zero.** Most often it is a statement nobody has
 * imported yet, and a zero would pull the answer towards nothing for a reason that has nothing to
 * do with the person's life.
 */
export const monthlyLeftovers = ({
  transactions,
  contributions,
  today,
}: CapacityInput): MonthLeftover[] => {
  const months = new Map<string, MonthLeftover>();

  transactions.forEach((transaction) => {
    const day = new Date(transaction.transactionDate);

    if (!withinWindow(day, today)) return;

    const key = monthKey(day);
    const month = months.get(key) ?? {
      year: day.getFullYear(),
      monthIndex: day.getMonth(),
      leftover: 0,
    };

    months.set(key, { ...month, leftover: month.leftover + transaction.amount });
  });

  contributions.forEach((contribution) => {
    if (!contribution.transactionId) return;

    const day = new Date(contribution.contributedAt);
    const month = months.get(monthKey(day));

    if (!withinWindow(day, today) || !month) return;

    months.set(monthKey(day), { ...month, leftover: month.leftover + contribution.amount });
  });

  return [...months.values()]
    .sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex)
    .map((month) => ({ ...month, leftover: Number(month.leftover.toFixed(2)) }));
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
};

/**
 * What an ordinary month leaves over — the figure the app is allowed to make a suggestion from.
 *
 * **The median, not the mean.** One unusual month — a bonus, a boiler — would rewrite the
 * judgement, and the question is what an ordinary month looks like.
 *
 * **`undefined` until three months have happened.** Inventing this from one month would be the app
 * guessing about somebody's life, and the whole worth of the number is that it is evidence rather
 * than a plan. A screen with no answer says so; it does not print a confident zero.
 *
 * A negative answer is kept. Spending more than came in is the one thing somebody most needs
 * telling, and rounding it up to nothing would hide it.
 */
export const savingCapacity = (input: CapacityInput): number | undefined => {
  const leftovers = monthlyLeftovers(input);

  if (leftovers.length < MONTHS_BEFORE_AN_ANSWER) return undefined;

  return median(leftovers.map((month) => month.leftover));
};
