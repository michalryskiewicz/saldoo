import type { DBProfit } from '@/database/profits.ts';
import { MONTHS } from '@/lib/dates.ts';
import { costInMonth } from '@/lib/recurrence.ts';

export type ProfitsByMonth = { month: number; total: number };

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
