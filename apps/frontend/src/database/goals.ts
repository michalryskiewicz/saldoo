import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import type { Currency, STRATEGY_PART } from '@/constant.ts';
import i18n from '@/i18n.ts';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { setLastUpdated } from '@/database/meta.ts';
import { getSettings } from '@/database/settings.ts';
import type { Rollover } from '@/features/goals/services/rollover.service.ts';

/** Months of living costs the emergency fund is meant to cover. The level, not the amount. */
export type CoverageMonths = 3 | 6 | 12;

/**
 * Something a person decided to put money aside for.
 *
 * One shape covers the three kinds, because they turned out to be one mechanism seen from three
 * ends — a one-off with a date, a window that rolls every year, and a fund that never ends.
 *
 * **What is not here is as deliberate as what is.** There is no lifetime total: it is the closed
 * windows of the series plus what is in the pot now, and a second stored number could disagree
 * with the first. There is no exchange rate either — a contribution is valued at the rate of its
 * own date, which `convertDataToDesiredCurrency` reads for itself.
 */
export type DBGoal = {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
  description: string;
  /** Taken from settings when the goal is made, never asked for. */
  currency: Currency;
  /** Which part of the budgeting strategy a contribution to this meets. */
  strategyPart: STRATEGY_PART;
  /**
   * Whether the money is still the person's once the goal completes.
   *
   * IKE and the emergency fund keep theirs; a holiday spends it. It decides what the lifetime
   * figure of a series *means* — how much you have put through this, against how much you hold —
   * and therefore which of those two sentences the app is allowed to print.
   */
  keepsItsMoney: boolean;
  /** Typed by the person. Absent on the emergency fund, whose target is computed from costs. */
  target?: number;
  /** The day it is wanted by. Absent on a fund, which has a pace instead — see `monthlyPace`. */
  deadline?: Date;
  /** Present only on the emergency fund, and what makes it one: the level its target comes from. */
  coverageMonths?: CoverageMonths;
  /** What the person means to put aside each month. The fund has this where others have a date. */
  monthlyPace?: number;
  /** The year this window covers, for a goal that rolls. Absent on a one-off and on the fund. */
  year?: number;
  /** Ties the rolled-over windows of one yearly goal together, so a lifetime figure can be summed. */
  seriesId?: string;
  closedAt?: Date;
};

/**
 * A window of a yearly goal, after it has ended.
 *
 * A **fact**, not a ceremony, which is why it is here rather than in #99 with the monuments. #93
 * orders the releases *catches on → is true → is a game*, and a year that ended belongs to the
 * truth layer; what #99 adds on top is the question "reached, or given up?", the wording, and the
 * thresholds worth celebrating.
 *
 * Without it a rollover is silent data loss: the pot empties and the 26 000 that were in it have
 * nowhere to be. It is also the only reason a lifetime figure can be summed rather than stored.
 */
export type DBClosedWindow = {
  id: string;
  createdAt: Date;
  goalId: string;
  /** Absent on a goal closed by hand rather than rolled: it belongs to no series. */
  seriesId?: string;
  /** The year the window covered, for a rollover. */
  year?: number;
  /** What the goal was aiming at over that window. */
  target: number;
  /** What actually went in, which is the part worth keeping. */
  contributed: number;
  openedOn: Date;
  closedOn: Date;
  /**
   * Whether the goal was reached, for one closed by hand. Absent on a window that simply rolled —
   * a year ending is not a decision and nobody was asked.
   */
  reached?: boolean;
  /** How long it took, in months. Absent on a rollover, whose length is a year by definition. */
  monthsItTook?: number;
};

/** A goal as the form hands it over: everything but the parts the app knows on its own. */
export type GoalDraft = Omit<DBGoal, 'id' | 'createdAt' | 'updatedAt' | 'currency'>;

/**
 * Whether this goal is the emergency fund.
 *
 * Derived from the level rather than stored beside it. A second field saying the same thing is a
 * second thing that can disagree — and the level is already the only part of a fund that a person
 * decides, since its amount is worked out from their costs.
 */
export const isEmergencyFund = (goal: Pick<DBGoal, 'coverageMonths'>): boolean =>
  goal.coverageMonths !== undefined;

/**
 * @returns whether the write landed. Callers close a drawer on the strength of this: reporting
 * nothing made a save that never happened look exactly like one that did.
 */
export const addDBGoal = async (
  draft: GoalDraft,
  { quietly = false }: { quietly?: boolean } = {}
): Promise<boolean> => {
  try {
    const { currency } = await getSettings();

    // A goal with a year rolls, and a goal that rolls belongs to a series — the thing that makes a
    // lifetime figure summable. Minted here rather than asked of the caller: a form has no business
    // inventing an identity, and rollover reuses whichever one it finds.
    const series = draft.year !== undefined ? { seriesId: draft.seriesId ?? uuidv4() } : {};

    await documentSession.put('goals', {
      id: uuidv4(),
      createdAt: new Date(),
      ...draft,
      ...series,
      currency,
    });
    await setLastUpdated();
    outbox.markDirty();
    if (!quietly) toast(i18n.t('success.create-goal'));

    return true;
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.create-goal'));

    return false;
  }
};

/**
 * Puts a year to bed and opens the next one.
 *
 * Three writes and all three matter: without the record the money that was in the pot is nowhere,
 * without the new window there is nothing to contribute to in January, and without closing the old
 * one the app rolls it again on the next visit.
 *
 * Silent by design — no toast. A year ending is not something the person did, and telling them
 * about it as though it were an action of theirs is the kind of noise that teaches people to
 * dismiss notices without reading them.
 */
export const applyDBRollovers = async (rollovers: Rollover[]): Promise<void> => {
  for (const { closing, opening } of rollovers) {
    try {
      await documentSession.put('closedWindows', {
        id: uuidv4(),
        createdAt: new Date(),
        ...closing,
      });

      await addDBGoal(opening, { quietly: true });

      await documentSession.update('goals', closing.goalId, {
        closedAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (e) {
      // Left for the next visit rather than half-applied: the guards in `rolloversDue` are what
      // make trying again safe, and a year that failed to close is still a year that ended.
      console.error(e);
      return;
    }
  }

  if (rollovers.length) {
    await setLastUpdated();
    outbox.markDirty();
  }
};
