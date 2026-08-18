import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import i18n from '@/i18n.ts';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { setLastUpdated } from '@/database/meta.ts';
import type { Currency } from '@/constant.ts';

/** Whether the interest joins the capital or leaves for the person's account. */
export type BondInterest = 'compounds' | 'pays out';

/** How often that happens. */
export type BondPeriod = 'monthly' | 'yearly';

/**
 * Retail treasury bonds somebody holds.
 *
 * **Not priced, computed.** These have no market price — nobody quotes them — so their value is
 * not fetched from anywhere. It follows from the day they were bought, how many were bought, and
 * the rate announced for the period. That is why this is possible at all without #30, which is a
 * spike about the legal side of *market* pricing and does not reach here.
 *
 * **Series are not modelled and that is on purpose.** EDO, COI, TOS, ROR and OTS differ in exactly
 * three things a person can state: the rate for this period, whether the interest joins the
 * capital, and how often. Naming the series instead would mean hard-coding five formulas — and a
 * formula that is subtly wrong prints a confident figure about somebody's real money. The person
 * has the rate on their account; the app does the arithmetic and none of the guessing.
 *
 * Automatic rates are a later step, and there is a precedent for it that respects the app's
 * premise: `ExchangeRate` on the backend is a rebuildable cache of public NBP data. Coupon rates
 * are the same kind of thing — public, and nobody's.
 */
export type DBBondHolding = {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
  /** What the person calls them, usually the series code. */
  description: string;
  quantity: number;
  /** What one is worth at issue — 100 zł for every retail series today, and still not assumed. */
  nominal: number;
  boughtOn: Date;
  /** The rate announced for the current period, as a percentage. */
  ratePercent: number;
  interest: BondInterest;
  period: BondPeriod;
  currency: Currency;
};

export type BondDraft = Omit<DBBondHolding, 'id' | 'createdAt' | 'updatedAt'>;

/** @returns whether the write landed, so a caller can keep its drawer open when it did not. */
export const addDBBond = async (draft: BondDraft): Promise<boolean> => {
  try {
    await documentSession.put('bonds', { id: uuidv4(), createdAt: new Date(), ...draft });
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.create-bond'));

    return true;
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.create-bond'));

    return false;
  }
};

/** @returns whether the write landed. */
export const updateDBBond = async (id: string, draft: BondDraft): Promise<boolean> => {
  try {
    await documentSession.update('bonds', id, { ...draft, updatedAt: new Date() });
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.update-bond'));

    return true;
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.update-bond'));

    return false;
  }
};

export const deleteDBBond = async (id: string): Promise<void> => {
  try {
    await documentSession.remove('bonds', id);
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.deleted-bond'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.deleted-bond'));
  }
};
