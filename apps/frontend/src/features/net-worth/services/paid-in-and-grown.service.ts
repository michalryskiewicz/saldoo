import type { Currency } from '@/constant.ts';
import type { GoalAssignment } from '@/database/goals.ts';

/** What went into a holding by hand, and what the holding did on its own. */
export type PaidInAndGrown = {
  positionId: string;
  /** Declared into the goal this holding wholly serves. */
  paidIn: number;
  /** Signed — a holding worth less than went into it has lost, and says so. */
  grown: number;
  currency: Currency;
};

type AssignedHolding = {
  id: string;
  value: number;
  currency: Currency;
  assignments?: GoalAssignment[];
};

/** A declaration, already in the currency the screen reads — a contribution carries none of its own. */
type Declared = { goalId: string; amount: number };

const round = (amount: number) => Number(amount.toFixed(2));

/**
 * What was put into a holding by hand, and what it earned by itself.
 *
 * The fact anybody investing by hand wants and a stored value cannot carry: 3 000 in an account says
 * nothing about whether it was earned or paid in. Declaring 2 500 into a goal and finding 3 000 in
 * the account behind it means 500 was earned.
 *
 * **Read off what is already recorded, with no new field anywhere.** Pointing a holding at a goal
 * switches that goal to reading the holding, and its declarations stop counting towards progress
 * while staying on record — so those surviving declarations *are* the register of what went in. This
 * only reads them.
 *
 * **Silent wherever the arrangement does not say.** A share below the whole, a holding split between
 * goals, or a second holding serving the same goal all leave "which declarations landed here"
 * unanswerable, and the value of this figure is that it is a fact rather than an apportionment the
 * app invented. Nothing for those rows.
 *
 * Both sides must arrive in the same currency. The declarations carry the goal's and the holding
 * carries its own, so a caller handing over one converted and one not would produce a difference
 * that is mostly the exchange rate.
 */
export const paidInAndGrown = (
  positionId: string,
  holdings: AssignedHolding[],
  declared: Declared[]
): PaidInAndGrown | undefined => {
  const holding = holdings.find((one) => one.id === positionId);
  const assignments = holding?.assignments ?? [];

  if (!holding || assignments.length !== 1) return undefined;

  const [assignment] = assignments;
  if (assignment.share !== 100) return undefined;

  const alsoServing = holdings.some(
    (other) =>
      other.id !== holding.id &&
      (other.assignments ?? []).some((one) => one.goalId === assignment.goalId)
  );

  if (alsoServing) return undefined;

  const paidIn = round(
    declared
      .filter((one) => one.goalId === assignment.goalId)
      .reduce((total, one) => total + one.amount, 0)
  );

  return {
    positionId: holding.id,
    paidIn,
    grown: round(holding.value - paidIn),
    currency: holding.currency,
  };
};
