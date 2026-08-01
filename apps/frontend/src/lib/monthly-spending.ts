import { daysInMonth } from '@/lib/dates.ts';

export type DaySpending = { day: number; spent: number };

type DatedPayment = { transactionDate: string; amount: number };

/**
 * What left the account on each day of the month being read.
 *
 * Every day is present, including the ones nothing happened on: a day with nothing spent is a
 * gap in the row of bars, and the gaps are half of what the card says. Left out, a run of busy
 * days would be drawn as though it were unbroken.
 *
 * Money arriving is not spending and is left out rather than netted off — a salary landing on
 * the ninth would otherwise cancel that day's payments and report the opposite of what happened.
 */
export const spendingByDayOfMonth = (
  payments: DatedPayment[],
  month: Date
): DaySpending[] => {
  const totals = Array<number>(daysInMonth(month.getFullYear(), month.getMonth())).fill(0);

  payments.forEach((payment) => {
    if (!payment.transactionDate || payment.amount >= 0) return;

    const paidOn = new Date(payment.transactionDate);
    if (
      paidOn.getFullYear() !== month.getFullYear() ||
      paidOn.getMonth() !== month.getMonth()
    ) {
      return;
    }

    totals[paidOn.getDate() - 1] += Math.abs(payment.amount);
  });

  return totals.map((spent, index) => ({ day: index + 1, spent: Number(spent.toFixed(2)) }));
};

/**
 * The day the most left on, if any did.
 *
 * Named in words under the chart, because "which day was the expensive one" is the question the
 * card is asked and reading it off a row of bars is work the card can do instead.
 */
export const peakSpendingDay = (days: DaySpending[]): DaySpending | undefined =>
  days.reduce<DaySpending | undefined>(
    (peak, day) => (day.spent > (peak?.spent ?? 0) ? day : peak),
    undefined
  );
