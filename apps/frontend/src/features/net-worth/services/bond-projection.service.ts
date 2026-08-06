import { addMonths, differenceInCalendarMonths, endOfMonth, startOfMonth } from 'date-fns';
import type { DBBondHolding } from '@/database/bonds.ts';
import type { Currency } from '@/constant.ts';
import { bondValueOn } from '@/features/net-worth/services/bond-accrual.service.ts';

/** One month of the chart: what was paid in, what it has earned, and whether it has happened yet. */
export type BondSeriesPoint = {
  /** The first day of the month this point describes, which is what the axis labels. */
  on: Date;
  capital: number;
  /**
   * Everything the holdings have earned by then — interest that joined the capital *and* interest
   * that was paid out to the person's account.
   *
   * Both, because the question this chart answers is what these bonds produce. That is a different
   * question from what the holdings are *worth*, which is why net worth counts only the first
   * (`netWorthWithBonds`) — the paid-out złoty is already sitting in an account that is a position
   * of its own, and adding it twice would be the same money counted twice.
   */
  interest: number;
  /** True once the month is past today's: the same arithmetic, about a day that has not come. */
  projected: boolean;
};

export type BondSeriesOptions = {
  today: Date;
  /** How far past today to carry the projection. */
  years: number;
};

const round = (amount: number) => Number(amount.toFixed(2));

/**
 * Splits holdings into the ones this chart can add up and a count of the ones it cannot.
 *
 * **A projection cannot be converted.** Today's holdings could be, at today's rate — but a point
 * five years out would need an exchange rate five years out, and there is no honest way to have
 * one. So a holding in another currency is left out and counted, and the chart says how many it
 * left out rather than quietly folding złoty and euro into one number.
 */
export const holdingsInCurrency = (
  bonds: DBBondHolding[],
  currency: Currency
): { included: DBBondHolding[]; excluded: number } => {
  const included = bonds.filter((bond) => bond.currency === currency);

  return { included, excluded: bonds.length - included.length };
};

const earliestPurchase = (bonds: DBBondHolding[]): Date =>
  bonds
    .map((bond) => new Date(bond.boughtOn))
    .reduce((earliest, day) => (day < earliest ? day : earliest));

/**
 * When to value a month.
 *
 * The end of it, except for the month we are in — that one is valued **today**. A rate is credited
 * at the end of an interest period, so valuing the current month at its end would print interest
 * the bond has not been paid yet, which is the one thing `bondValueOn` exists to refuse. Past
 * months are complete and future months are a projection anyway, so the end is right for both.
 */
const valuedOn = (month: Date, today: Date): Date => {
  const isCurrentMonth = differenceInCalendarMonths(month, today) === 0;

  return isCurrentMonth ? today : endOfMonth(month);
};

/**
 * The whole life of the holdings, month by month: from the earliest purchase to `years` past today.
 *
 * **The projection is not a second formula.** A future point is `bondValueOn` of a future day — the
 * same arithmetic as the history, carried forward at the rate the person entered. What changes is
 * only that the app admits it: every such point is marked `projected`, and the rate is known for
 * the current period alone.
 */
export const bondSeries = (
  bonds: DBBondHolding[],
  { today, years }: BondSeriesOptions
): BondSeriesPoint[] => {
  if (bonds.length === 0) return [];

  const first = startOfMonth(earliestPurchase(bonds));
  const last = addMonths(startOfMonth(today), years * 12);
  const currentMonth = startOfMonth(today);

  return Array.from({ length: differenceInCalendarMonths(last, first) + 1 }, (_, index) => {
    const month = addMonths(first, index);
    const on = valuedOn(month, today);
    // A bond bought later in the story is not held here yet, and `bondValueOn` answers about a
    // holding rather than about whether it exists.
    const held = bonds.filter((bond) => new Date(bond.boughtOn) <= on);
    const values = held.map((bond) => bondValueOn(bond, on));

    return {
      on: month,
      capital: round(values.reduce((total, value) => total + value.capital, 0)),
      interest: round(values.reduce((total, value) => total + value.accrued + value.paidOut, 0)),
      projected: month > currentMonth,
    };
  });
};
