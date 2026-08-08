import { v4 as uuidv4 } from 'uuid';
import type { GoalAssignment } from '@/database/goals.ts';
import { toast } from 'sonner';
import type { Currency } from '@/constant.ts';
import i18n from '@/i18n.ts';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { setLastUpdated } from '@/database/meta.ts';

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
  /** What this is for. Empty or missing means it is not spoken for — see `GoalAssignment`. */
  assignments?: GoalAssignment[];
};

export type PositionDraft = Omit<DBPosition, 'id' | 'createdAt' | 'updatedAt'>;

/** @returns whether the write landed, so a caller can keep its drawer open when it did not. */
export const addDBPosition = async (draft: PositionDraft): Promise<boolean> => {
  try {
    await documentSession.put('positions', { id: uuidv4(), createdAt: new Date(), ...draft });
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
    await documentSession.update('positions', id, { ...draft, updatedAt: new Date() });
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
