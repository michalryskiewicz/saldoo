import { FREQUENCY } from '@/constant.ts';
import type { DBProfit } from '@/database/profits.ts';
import { countWeekdaysInMonth, daysInMonth, getFromDate, MONTHS } from '@/lib/dates.ts';

export type ProfitsByMonth = { month: number; total: number };

/**
 * How many times a recurrence falls inside one month of one year.
 *
 * A yearly one falls in its own month and nowhere else; a weekly one as often as its weekday
 * comes round, which is four times in most months and five in some; a daily one once per day,
 * which is not a constant either.
 */
const occurrencesInMonth = (
  frequency: FREQUENCY | undefined,
  execution: Date | string,
  monthIndex: number
): number => {
  const { year, month, day } = getFromDate(execution);

  switch (frequency) {
    case FREQUENCY.YEARLY:
      return month === monthIndex ? 1 : 0;
    case FREQUENCY.MONTHLY:
      return 1;
    case FREQUENCY.WEEKLY:
      return countWeekdaysInMonth(year, monthIndex, day);
    case FREQUENCY.DAILY:
      return daysInMonth(year, monthIndex);
    default:
      return 0;
  }
};

/**
 * What arrives in each month of the year, with every recurrence counted as often as it happens.
 *
 * Written rather than borrowed from the overview's grouping, which adds every profit to all
 * twelve months whatever its frequency — so a one-off yearly commission of 3200 is reported as
 * 38 400 a year, and a weekly one at a twelfth of what it is.
 */
export function groupProfitsByMonth(profits: DBProfit[]): ProfitsByMonth[] {
  const totals = Array<number>(12).fill(0);

  profits.forEach((item) => {
    // A recurrence needs a day to recur on. Without one there is no month to count it in, and
    // `getFromDate` answers with a month of -1 rather than refusing.
    if (!item.execution) return;

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      totals[monthIndex] += item.profit * occurrencesInMonth(item.frequency, item.execution, monthIndex);
    }
  });

  return MONTHS.map((_, monthIndex) => ({
    month: monthIndex,
    total: Number(totals[monthIndex].toFixed(2)),
  }));
}
