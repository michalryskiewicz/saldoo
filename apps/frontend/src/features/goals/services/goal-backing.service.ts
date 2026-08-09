import type { GoalAssignment } from '@/database/goals.ts';

/**
 * Anything that can stand behind a goal: a hand-valued position, or a bond the app prices itself.
 *
 * Structural rather than a union of the two record types, because what matters here is that it has
 * a value and something it is for. It must arrive **already converted** — this adds figures up, and
 * conversion in this app happens before the arithmetic.
 */
export type BackableHolding = {
  id: string;
  description: string;
  value: number;
  assignments?: GoalAssignment[];
};

/** One holding's contribution to one goal. */
export type Backing = {
  id: string;
  description: string;
  /** The percentage assigned, kept so the screen can say "60% of this". */
  share: number;
  /** What that share is worth today. */
  value: number;
};

const round = (amount: number) => Number(amount.toFixed(2));

/** How much of a holding is spoken for, across every goal it serves. */
export const assignedShare = (holding: BackableHolding): number =>
  (holding.assignments ?? []).reduce((total, assignment) => total + assignment.share, 0);

/**
 * What stands behind a goal, biggest first.
 *
 * Named rather than only summed: "4,2 months of cover" invites the question *out of what*, and a
 * card that cannot answer it is asking to be taken on faith.
 */
export const backingOf = (goalId: string, holdings: BackableHolding[]): Backing[] =>
  holdings
    .flatMap((holding) =>
      (holding.assignments ?? [])
        .filter((assignment) => assignment.goalId === goalId)
        .map((assignment) => ({
          id: holding.id,
          description: holding.description,
          share: assignment.share,
          value: round((holding.value * assignment.share) / 100),
        }))
    )
    .sort((a, b) => b.value - a.value);

/**
 * What a goal is actually worth today, out of the things pointed at it.
 *
 * This is a **stock read straight from the holdings**, not a ledger of declarations — which is the
 * whole difference between a goal that has to be maintained and one that is simply true. It
 * follows a holding down as readily as up: somebody who spends out of the account their emergency
 * fund sits in has a smaller fund, and the arithmetic saying so is the point rather than a flaw.
 */
export const backedValue = (goalId: string, holdings: BackableHolding[]): number =>
  round(backingOf(goalId, holdings).reduce((total, backing) => total + backing.value, 0));

/**
 * Money that is somewhere and is not for anything.
 *
 * The figure this whole idea exists to make sayable, and it is printed rather than left as a
 * subtraction for the reader. A holding promised past 100% contributes nothing free rather than a
 * negative amount: over-promising is a mistake to be seen, not arithmetic to be absorbed elsewhere.
 */
export const unassignedValue = (holdings: BackableHolding[]): number =>
  round(
    holdings.reduce(
      (total, holding) =>
        total + (holding.value * Math.max(0, 100 - assignedShare(holding))) / 100,
      0
    )
  );

/**
 * What is free, or nothing at all — for a tile that stays quiet until it has something to add.
 *
 * On an account where nobody has assigned anything, what is free *is* what is held. Printing both
 * beside each other says one fact twice, and a line that repeats its neighbour teaches the reader
 * that the line carries no information. From the first assignment onwards, it carries one.
 */
export const freeValue = (holdings: BackableHolding[]): number | undefined =>
  holdings.some((holding) => assignedShare(holding) > 0) ? unassignedValue(holdings) : undefined;
