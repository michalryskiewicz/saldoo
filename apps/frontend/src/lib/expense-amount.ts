import type { DBExpense } from '@/database/expenses.ts';
import type { DBProfit } from '@/database/profits.ts';
import { type CalendarMonth, costInMonth } from '@/lib/recurrence.ts';
import { incomeBaseForMonth } from '@/lib/profits.ts';

/**
 * The month a share is taken of, which is not always the month it is paid in.
 *
 * Stepping back over January lands in the December before it, so the year moves too — a tax paid
 * in January is a share of the previous year's December.
 */
const baseMonthOf = (
  { year, monthIndex }: CalendarMonth,
  basePeriod: 'thisMonth' | 'previousMonth'
): CalendarMonth =>
  basePeriod === 'thisMonth'
    ? { year, monthIndex }
    : monthIndex === 0
      ? { year: year - 1, monthIndex: 11 }
      : { year, monthIndex: monthIndex - 1 };

/**
 * What one occurrence of a cost comes to in a given month.
 *
 * The step that had to exist before a cost could be a share of something. Every total in the app
 * used to read `expense.expense` straight off the record and hand it to `costInMonth`, which is
 * fine while an amount is a number a person typed — and impossible for a cost whose amount is
 * 12% of whatever last month's invoices came to.
 *
 * **The profits must already be in the currency the answer is wanted in.** A percentage is
 * dimensionless, so the amount it produces has the currency of its base and no currency of its
 * own; converting afterwards would be converting a figure that is already converted, and
 * converting the *percentage* — which is what happens if a share is pushed through the expense
 * conversion — turns 12 into 51 and calls it money.
 */
export const expenseAmountForMonth = (
  expense: DBExpense,
  profits: DBProfit[],
  month: CalendarMonth
): number => {
  const share = expense.percentageOfIncome;

  if (!share) return expense.expense;

  const base = incomeBaseForMonth(profits, share.profitIds, baseMonthOf(month, share.basePeriod));

  return Number(((base * share.percent) / 100).toFixed(2));
};

/**
 * What a cost comes to over a whole year.
 *
 * Twelve months added up rather than one amount multiplied, which is what `costInYear` does and
 * what it can only do: a share has a different base in every month, and for a cost that is 12% of
 * a single yearly invoice eleven of those months are zero. Multiplying any one of them by twelve
 * gives either nothing or twelve times too much.
 */
export const expenseCostInYear = (
  expense: DBExpense,
  profits: DBProfit[],
  year: number
): number =>
  Number(
    Array.from({ length: 12 }, (_, monthIndex) => {
      const month = { year, monthIndex };

      return costInMonth(expense, expenseAmountForMonth(expense, profits, month), month);
    })
      .reduce((total, month) => total + month, 0)
      .toFixed(2)
  );
