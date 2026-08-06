import type { Currency } from '@/constant.ts';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBProfit } from '@/database/profits.ts';
import { expenseAmountForMonth } from '@/lib/expense-amount.ts';

type Occurrence = { executionDate: Date | string; expense: DBExpense };

/** An occurrence with the money it is for, ready to be converted and added up. */
export type PricedOccurrence<T> = T & { price: number; currency: Currency };

/**
 * What each occurrence is for, as a figure of its own on the row.
 *
 * Flat on the row rather than read through `expense.expense` at every use, for two reasons that
 * both showed up as wrong numbers on the duties screen.
 *
 * The amount is not always on the record. A cost that is a share of an income has `expense: 0` and
 * an amount that depends on which month the occurrence falls in, so every place that read the field
 * directly showed a tax as 0,00 zł and left it out of the period's total.
 *
 * And a figure cannot be converted where it is nested. `convertDataToDesiredCurrency` reads
 * `currency` and the amount from the top level of a row, so the screen either converts nothing —
 * which is what it did, adding złoty to euro and labelling the result with whichever currency the
 * first row happened to be in — or the amount comes up to the top level first.
 */
export const withResolvedPrice = <T extends Occurrence>(
  duties: T[],
  profits: DBProfit[]
): PricedOccurrence<T>[] =>
  duties.map((duty) => {
    const day = new Date(duty.executionDate);

    return {
      ...duty,
      price: expenseAmountForMonth(duty.expense, profits, {
        year: day.getFullYear(),
        monthIndex: day.getMonth(),
      }),
      currency: duty.expense.currency,
    };
  });
