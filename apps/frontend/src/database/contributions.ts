import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import i18n from '@/i18n.ts';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { setLastUpdated } from '@/database/meta.ts';

/**
 * Money put aside towards a goal, on a day.
 *
 * Its own record rather than a transaction or an expense, and both refusals matter.
 *
 * **Not a transaction.** Those come from a bank import and carry a `hash` taken from the statement
 * line; a declaration has nothing to fill it with, and forging one poisons both import dedup and
 * the matching in #98.
 *
 * **Not an expense.** That is the thing this feature exists to undo — as an expense it would lower
 * "savings" on the overview by exactly the amount the person's net worth grew.
 *
 * It carries no currency of its own: that is the goal's, and a second copy is a second thing that
 * can disagree. It carries no exchange rate either — `convertDataToDesiredCurrency` reads the rate
 * for `contributedAt`, so what was put aside in March is worth what it was worth in March, forever.
 */
export type DBContribution = {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
  goalId: string;
  amount: number;
  contributedAt: Date;
  /**
   * Money coming **out** of the pot rather than going in.
   *
   * The table's name is narrower than what it holds, and that is a deliberate trade: renaming a
   * table in the document means every existing record moving, and a flag costs one field. What it
   * buys is the property #93 pt. 5 asks for — the pot falls honestly when the money is spent and
   * what was *built* never falls, because one figure counts both directions and the other only
   * counts inwards.
   *
   * A partial withdrawal is never questioned anywhere. Taking money out of a fund because the car
   * broke is exactly what it was for.
   */
  isWithdrawal?: boolean;
  /**
   * The statement line that backs this, once one is found — #98.
   *
   * Absent means nobody has looked yet, which is the ordinary state and never a failing: the
   * figure grows on declarations and what a statement confirms is shown beside it, never instead.
   */
  transactionId?: string | null;
  /**
   * Payments the person has said are not this one's.
   *
   * Recorded rather than blocking the contribution outright: matching is a ±4 day window, so it
   * can land on the wrong transfer, and a contribution that could never match again would punish
   * somebody for correcting the guess.
   */
  rejectedTransactionIds?: string[];
};

export type ContributionDraft = Omit<DBContribution, 'id' | 'createdAt' | 'updatedAt'>;

/** @returns whether the write landed, so a caller can keep its drawer open when it did not. */
export const addDBContribution = async (draft: ContributionDraft): Promise<boolean> => {
  try {
    await documentSession.put('contributions', {
      id: uuidv4(),
      createdAt: new Date(),
      ...draft,
    });
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.create-contribution'));

    return true;
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.create-contribution'));

    return false;
  }
};
