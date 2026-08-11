import type { DBExpense } from '@/database/expenses.ts';
import type { DBProfit } from '@/database/profits.ts';
import type { ConvertedFrom, MaybeConverted } from '@/lib/exchange-rate.ts';
import { expenseCostInYear } from '@/lib/expense-amount.ts';
import { costInYear } from '@/lib/recurrence.ts';

/**
 * What the yearly cost would read in the currency the amount was entered in.
 *
 * The yearly column is a multiple of the *converted* amount, so it cannot borrow the mark from the
 * monthly figure beside it: naming 45 zł under a figure of twelve times that would be a lie about
 * exactly the thing the mark exists to be honest about. It gets its own origin, put through the same
 * arithmetic on the original amount.
 *
 * **Nothing for a cost that is a share of an income.** Such a cost has no amount of its own — its
 * `expense` is nought and the yearly figure comes from the incomes, which were converted on their
 * own. There is no original of *this* figure to name, and a mark quoting nought would be worse than
 * no mark at all.
 */
export const yearlyCostOrigin = (
  expense: MaybeConverted<DBExpense>,
  profits: DBProfit[],
  year: number
): ConvertedFrom | undefined => {
  if (!expense.convertedFrom || expense.percentageOfIncome) return undefined;

  return {
    amount: expenseCostInYear(
      { ...expense, expense: expense.convertedFrom.amount },
      profits,
      year
    ),
    currency: expense.convertedFrom.currency,
  };
};

/**
 * The same, for an income.
 *
 * Its own function rather than a shared one: `costInYear` takes the amount as an argument for an
 * income and reads it off the record for an expense, and a wrapper hiding that difference would be
 * a third thing to keep in step with both.
 */
export const yearlyIncomeOrigin = (
  profit: MaybeConverted<DBProfit>,
  year: number
): ConvertedFrom | undefined =>
  profit.convertedFrom
    ? {
        amount: costInYear(profit, profit.convertedFrom.amount, year),
        currency: profit.convertedFrom.currency,
      }
    : undefined;
