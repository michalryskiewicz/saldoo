import type { Currency, FREQUENCY, SEVERITY, STRATEGY_PART } from '@/constant.ts';
import { v4 as uuidv4 } from 'uuid';
import type { ExpenseCreateType } from '@/features/expenses/components/expenses-create.tsx';
import { toast } from 'sonner';
import i18n from '@/i18n.ts';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { setLastUpdated } from '@/database/meta.ts';

export type DBExpense = {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
  userId?: string;
  description: string;
  expense: number;
  currency: Currency;
  /**
   * How urgent this cost is. Optional only because records written before it existed have none.
   *
   * Also what answers `survivesIncomeLoss` for a cost that has never been asked — see there for
   * why that stays safe now the field is editable again.
   */
  severity?: SEVERITY | null;
  /**
   * Whether this cost would still be there with no income coming in — see `survivesIncomeLoss`.
   *
   * Absent means nobody has answered it, and the answer is derived rather than stored. Rewriting
   * every record to say out loud what can be computed would push the whole vault through the
   * outbox to every device (ADR 0001) for no new information.
   */
  survivesIncomeLoss?: boolean;
  frequency?: FREQUENCY;
  /** How many units of the frequency between occurrences. Absent means every one. */
  interval?: number;
  execution?: Date;
  /** The last day it recurs on. Absent means it goes on — see `Recurrence.endsAt`. */
  endsAt?: Date;
  strategyPart?: STRATEGY_PART;
  tagId?: string;
};

/**
 * @returns whether the write landed. Callers close a drawer on the strength of this: reporting
 * nothing made a save that never happened look exactly like one that did, and the only
 * difference was a toast that is easy to miss.
 */
export const addDBExpense = async (expense: Omit<ExpenseCreateType, 'cadence'>) => {
  try {
    await documentSession.put('expenses', {
      id: uuidv4(),
      createdAt: new Date(),
      ...expense,
      currency: expense.currency as Currency,
      severity: expense.severity as SEVERITY,
      survivesIncomeLoss: expense.survivesIncomeLoss === 'yes',
      frequency: expense.frequency as FREQUENCY,
      strategyPart: expense.strategyPart as STRATEGY_PART,
    });
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.create-expense'));

    return true;
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.create-expense'));

    return false;
  }
};

/**
 * @returns whether the write landed. Callers close a drawer on the strength of this: reporting
 * nothing made a save that never happened look exactly like one that did, and the only
 * difference was a toast that is easy to miss.
 */
export const updateDBExpense = async (id: string, expense: Omit<ExpenseCreateType, 'cadence'>) => {
  try {
    await documentSession.update('expenses', id, {
      ...expense,
      updatedAt: new Date(),
      currency: expense.currency as Currency,
      severity: expense.severity as SEVERITY,
      survivesIncomeLoss: expense.survivesIncomeLoss === 'yes',
      frequency: expense.frequency as FREQUENCY,
      strategyPart: expense.strategyPart as STRATEGY_PART,
    });
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.update-expense'));

    return true;
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.update-expense'));

    return false;
  }
};

export const deleteDBExpense = async (id: string) => {
  try {
    await documentSession.remove('expenses', id);
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.deleted-expense'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.deleted-expense'));
  }
};
