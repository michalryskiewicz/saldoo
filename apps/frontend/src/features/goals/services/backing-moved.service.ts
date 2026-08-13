import type { BackableHolding } from '@/features/goals/services/goal-backing.service.ts';

/** What the holdings behind a goal have done since anybody last valued them. */
export type BackingMoved = {
  /** Signed, and share-weighted: a holding backing half a goal moves it by half of what it did. */
  amount: number;
  /** The earliest reading it is measured from, so the sentence cannot claim a shorter window. */
  since: Date;
};

const round = (amount: number) => Number(amount.toFixed(2));

/**
 * Why a goal's figure changed when nobody put anything in or took anything out.
 *
 * A goal reading its holdings reads an account, so spending out of that account takes the goal down
 * with it. The arithmetic is right and that is the point of reading a stock — but on the screen it
 * looks like a fault, or worse like something the person did and cannot remember, unless the cause is
 * named. This is the cause.
 *
 * Weighted by share, because a holding that backs half a goal moved it by half of what it did.
 *
 * **Nothing where nothing moved,** including where the moves cancel out. A goal whose holdings have
 * each been valued once has no before to have moved from, and nought would read as "it held steady" —
 * a claim nobody has made.
 */
export const backingMoved = (
  goalId: string,
  holdings: BackableHolding[]
): BackingMoved | undefined => {
  const behind = holdings.flatMap((holding) =>
    (holding.assignments ?? [])
      .filter((assignment) => assignment.goalId === goalId && holding.change)
      .map((assignment) => ({
        amount: (holding.change!.amount * assignment.share) / 100,
        since: new Date(holding.change!.since),
      }))
  );

  if (!behind.length) return undefined;

  const amount = round(behind.reduce((total, one) => total + one.amount, 0));

  if (!amount) return undefined;

  return {
    amount,
    since: new Date(Math.min(...behind.map((one) => one.since.getTime()))),
  };
};
