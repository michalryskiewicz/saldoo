import { v4 as uuidv4 } from 'uuid';
import type { GoalAssignment } from '@/database/goals.ts';
import { toast } from 'sonner';
import type { ASSET_TYPE, Currency } from '@/constant.ts';
import i18n from '@/i18n.ts';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { setLastUpdated } from '@/database/meta.ts';
import { addDBValuation } from '@/database/valuations.ts';
import { isNewReading } from '@/features/net-worth/services/valuation-history.service.ts';
import { db } from '@/database/index.ts';

/** Something held, or something owed. Both are positions; only the sign differs. */
export type PositionKind = 'asset' | 'liability';

/**
 * A thing somebody holds or owes, worth what they say it is worth.
 *
 * **Valued by the person, not by the app.** Automatic pricing is #30 and that is a spike about the
 * legal options rather than a task, so the honest thing is a figure with a date on it: what it was
 * worth, when they last looked.
 *
 * **A goal is not one of these and never feeds them.** A goal's saved total is the sum of what was
 * declared; a position's value is what the thing is worth, and for anything invested those differ
 * by the returns — which is most of the point of holding it. Somebody with 26 000 declared into
 * IKE and 31 000 sitting there would see the smaller figure, wrong in the direction that matters.
 * The two describe the same money and must never be added together.
 */
export type DBPosition = {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
  description: string;
  kind: PositionKind;
  value: number;
  currency: Currency;
  /** The day the person last said what it was worth. */
  valuedOn: Date;
  /**
   * What kind of thing it is, which is what an allocation is a breakdown of.
   *
   * Absent on every holding that existed before this was asked for. Guessing a type would put money
   * into a bucket the person never chose, so an allocation counts the untyped apart and says so.
   */
  assetType?: ASSET_TYPE;
  /**
   * How many of it there are, and what one costs — where the holding is the kind somebody counts.
   *
   * **Not a second source of truth.** `value` remains the one figure every screen reads; these record
   * how it was arrived at, and it is computed from them when both are given. A count and a price
   * stored beside a total they disagree with is a bug with nothing to say which number is right.
   *
   * The price is the half meant to be filled in for somebody one day (#30 — a spike about the legal
   * and technical options for market data, not a task). Until then it is typed like the rest.
   */
  units?: number;
  unitPrice?: number;
  /** What this is for. Empty or missing means it is not spoken for — see `GoalAssignment`. */
  assignments?: GoalAssignment[];
};

export type PositionDraft = Omit<DBPosition, 'id' | 'createdAt' | 'updatedAt'>;

/** @returns whether the write landed, so a caller can keep its drawer open when it did not. */
export const addDBPosition = async (draft: PositionDraft): Promise<boolean> => {
  try {
    const id = uuidv4();

    await documentSession.put('positions', { id, createdAt: new Date(), ...draft });

    // The first reading, filed at once. A holding whose history begins at its *second* valuation has
    // nothing for that one to be compared against, so this is the save that cannot be skipped.
    await addDBValuation({
      positionId: id,
      value: draft.value,
      currency: draft.currency,
      valuedOn: draft.valuedOn,
    });

    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.create-position'));

    return true;
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.create-position'));

    return false;
  }
};

/** @returns whether the write landed. */
export const updateDBPosition = async (id: string, draft: PositionDraft): Promise<boolean> => {
  try {
    // Read before the write, or there is nothing left to compare the new figure with: the position
    // holds one value and this update is about to replace it.
    const stored = await db.positions.get(id);

    await documentSession.update('positions', id, { ...draft, updatedAt: new Date() });

    if (isNewReading(draft, stored)) {
      await addDBValuation({
        positionId: id,
        value: draft.value,
        currency: draft.currency,
        valuedOn: draft.valuedOn,
      });
    }

    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.update-position'));

    return true;
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.update-position'));

    return false;
  }
};

export const deleteDBPosition = async (id: string): Promise<void> => {
  try {
    await documentSession.remove('positions', id);
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.deleted-position'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.deleted-position'));
  }
};
