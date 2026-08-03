import type { DBProfit } from '@/database/profits.ts';
import { MONTHS } from '@/lib/dates.ts';
import { type CalendarMonth, costInMonth } from '@/lib/recurrence.ts';

export type ProfitsByMonth = { month: number; total: number };

/**
 * What a named set of incomes brings in over one month — the base a percentage is taken of.
 *
 * Named rather than "everything that arrived": a flat-rate tax is a share of *this invoice*, not
 * of every złoty that reached the account, and a household with a second salary in it would
 * otherwise be taxed on their partner's.
 *
 * Gross, and there is no option for anything else. A base computed after expenses would feed a
 * percentage expense into its own input; this is not caution, it is the only thing preventing a
 * cycle.
 *
 * An id that matches nothing contributes nothing, which is how a deleted income reads here. That
 * a base of zero and a base that has gone missing are different situations is a question for the
 * caller — this one only adds up what it can find.
 */
export const incomeBaseForMonth = (
  profits: DBProfit[],
  profitIds: string[],
  month: CalendarMonth
): number =>
  Number(
    profits
      .filter((profit) => profitIds.includes(profit.id))
      .reduce((base, profit) => base + costInMonth(profit, profit.profit, month), 0)
      .toFixed(2)
  );

/**
 * What arrives in each month of one year, with every recurrence counted as often as it happens.
 *
 * Written rather than borrowed from the overview's grouping, which adds every profit to all
 * twelve months whatever its frequency — so a one-off yearly commission of 3200 is reported as
 * 38 400 a year, and a weekly one at a twelfth of what it is.
 */
export function groupProfitsByMonth(
  profits: DBProfit[],
  year: number = new Date().getFullYear()
): ProfitsByMonth[] {
  const totals = Array<number>(12).fill(0);

  profits.forEach((item) => {
    // A recurrence needs a day to recur on. Without one there is no month to count it in.
    if (!item.execution) return;

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      totals[monthIndex] += costInMonth(item, item.profit, { year, monthIndex });
    }
  });

  return MONTHS.map((_, monthIndex) => ({
    month: monthIndex,
    total: Number(totals[monthIndex].toFixed(2)),
  }));
}
