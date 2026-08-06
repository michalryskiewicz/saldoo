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
  /**
   * The share of a named income this cost is, for costs that have no amount of their own — a
   * flat-rate tax, a percentage for the accountant.
   *
   * Absent is the ordinary case: `expense` is the amount and that is all. Present, `expense` is
   * meaningless and the amount is worked out per month — see `expenseAmountForMonth`.
   *
   * The three parts mean nothing apart and always move together, so they travel as one object.
   * `basePeriod` is which month the share is taken of: a flat-rate tax is due by the 20th of the
   * month after the invoice it is a share of.
   */
  percentageOfIncome?: {
    percent: number;
    profitIds: string[];
    basePeriod: 'thisMonth' | 'previousMonth';
  };
  frequency?: FREQUENCY;
  /** How many units of the frequency between occurrences. Absent means every one. */
  interval?: number;
  execution?: Date;
  /** The last day it recurs on. Absent means it goes on — see `Recurrence.endsAt`. */
  endsAt?: Date;
  strategyPart?: STRATEGY_PART;
  tagId?: string;
};

type CostFromForm = Omit<ExpenseCreateType, 'cadence'>;

/**
 * The parts of a cost the form asks about in pieces and the record holds as a whole.
 *
 * A share is three fields on screen and one object in the vault, because its three parts mean
 * nothing apart and must never drift out of step. `expense` is zero for a share: the amount is not
 * a number anybody typed, it is worked out per month from the invoices.
 *
 * `undefined` on the way back to a plain amount is load-bearing — `updateFields` removes a field
 * given as undefined, and without that the share would stay on the record and every total would go
 * on taking 12% of an invoice the cost no longer has anything to do with.
 *
 * The fund question goes the same way: a share is never in the fund, and storing an answer nobody
 * was asked would leave a value the app contradicts.
 */
const asStoredCost = (form: CostFromForm) =>
  form.amountMode === 'share'
    ? {
        expense: 0,
        percentageOfIncome: {
          percent: form.percent as number,
          profitIds: form.profitIds as string[],
          basePeriod: form.basePeriod as 'thisMonth' | 'previousMonth',
        },
        survivesIncomeLoss: undefined,
      }
    : {
        expense: form.expense as number,
        percentageOfIncome: undefined,
        survivesIncomeLoss: form.survivesIncomeLoss === 'yes',
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
      ...asStoredCost(expense),
      currency: expense.currency as Currency,
      severity: expense.severity as SEVERITY,
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
      ...asStoredCost(expense),
      currency: expense.currency as Currency,
      severity: expense.severity as SEVERITY,
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
