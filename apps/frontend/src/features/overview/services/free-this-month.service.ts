import type { DBTransaction } from '@/database/transactions.ts';
import type { DBContribution } from '@/database/contributions.ts';
import type { DBDuty } from '@/database/duty.ts';
import type { DBGoal } from '@/database/goals.ts';
import { requiredMonthlyContribution } from '@/lib/goals.ts';

/**
 * An occurrence with the amount it is for, which the record itself does not carry.
 *
 * Only the fields this reads, so a caller can hand over whatever else it has joined on — the
 * overview's duties arrive carrying their expense, and it is none of this function's business.
 */
export type PricedDuty = Pick<
  DBDuty,
  'executionDate' | 'resolved' | 'ignored' | 'transactionId'
> & { price: number };

type FreeThisMonthInput = {
  /** What the month is planned to bring in, from the incomes and their cadences. */
  plannedIncome: number;
  transactions: DBTransaction[];
  duties: PricedDuty[];
  goals: DBGoal[];
  contributions: DBContribution[];
  today: Date;
};

export type FreeThisMonth = {
  /** The one figure: what nothing has a claim on yet. */
  free: number;
  plannedIncome: number;
  /** What has already left the account. */
  spent: number;
  /** What is still to be paid before the month is out. */
  owed: number;
  /** What the goals need this month and have not had yet. */
  goalsToFund: number;
  /** How many occurrences make up `owed`, so the screen can say "after three bills". */
  owedCount: number;
};

const inMonth = (day: Date | string, today: Date): boolean => {
  const date = new Date(day);

  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
};

const round = (amount: number): number => Number(amount.toFixed(2));

/**
 * What is genuinely free to dispose of before the month is out.
 *
 * Not "income less costs", which is the figure this app has spent two releases undoing: that one
 * reads a late bill as a good month and a transfer between somebody's own pockets as a loss. This
 * one asks what has a claim on the money — what has gone, what is still owed, and what the goals
 * were promised — and reports the remainder.
 *
 * **It is not a bank balance and must never be printed as one.** There is no account model here,
 * so this is derived from the plan and the occurrences, not from what a bank says is there.
 *
 * **Every cost is counted once.** A duty with a payment behind it *is* that payment, so it is left
 * to the transaction; a duty ticked off by hand with no statement line has no transaction to be
 * left to, and is counted here instead — the gap that would otherwise let a cost fall out of both
 * figures and quietly inflate what is free. Skipped occurrences are in neither: nothing is owed and
 * nothing was paid.
 *
 * **Saying money went aside does not make somebody richer.** A goal reserves the larger of what it
 * needs this month and what has already gone into it, less whatever a statement has confirmed —
 * which is already an outflow above. So a declaration stays reserved, a confirmed transfer is
 * counted exactly once, and putting in more than the month asked for reserves the larger figure.
 *
 * Negative is a real answer and is kept. A month that owes more than it earns is the one a person
 * most needs to see.
 */
export const freeThisMonth = ({
  plannedIncome,
  transactions,
  duties,
  goals,
  contributions,
  today,
}: FreeThisMonthInput): FreeThisMonth => {
  const paidOut = transactions
    .filter((transaction) => inMonth(transaction.transactionDate, today) && transaction.amount < 0)
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);

  const thisMonthsDuties = duties.filter(
    (duty) => inMonth(duty.executionDate, today) && !duty.ignored && !duty.transactionId
  );

  const tickedOffByHand = thisMonthsDuties
    .filter((duty) => duty.resolved)
    .reduce((total, duty) => total + duty.price, 0);

  const stillOwed = thisMonthsDuties.filter((duty) => !duty.resolved);

  const contributionsThisMonth = contributions.filter((contribution) =>
    inMonth(contribution.contributedAt, today)
  );

  const towards = (goalId: string, only: (contribution: DBContribution) => boolean): number =>
    contributionsThisMonth
      .filter((contribution) => contribution.goalId === goalId && only(contribution))
      .reduce((total, contribution) => total + contribution.amount, 0);

  const openGoals = goals.filter((goal) => !goal.closedAt);

  const reserved = openGoals.reduce((total, goal) => {
    const saved = contributions
      .filter((contribution) => contribution.goalId === goal.id)
      .reduce((sum, contribution) => sum + contribution.amount, 0);

    const required = goal.deadline
      ? requiredMonthlyContribution({ target: goal.target ?? 0, saved, deadline: goal.deadline }, today)
      : (goal.monthlyPace ?? 0);

    return total + Math.max(required, towards(goal.id, () => true));
  }, 0);

  const confirmed = openGoals.reduce(
    (total, goal) => total + towards(goal.id, (contribution) => Boolean(contribution.transactionId)),
    0
  );

  const spent = round(paidOut + tickedOffByHand);
  const owed = round(stillOwed.reduce((total, duty) => total + duty.price, 0));
  const goalsToFund = round(Math.max(0, reserved - confirmed));

  return {
    free: round(plannedIncome - spent - owed - goalsToFund),
    plannedIncome: round(plannedIncome),
    spent,
    owed,
    goalsToFund,
    owedCount: stillOwed.length,
  };
};
