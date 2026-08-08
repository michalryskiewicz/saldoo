import { addMonths, differenceInCalendarMonths, endOfMonth, startOfMonth } from 'date-fns';
import type { DBBondHolding } from '@/database/bonds.ts';
import type { Currency } from '@/constant.ts';
import { bondValueOn } from '@/features/net-worth/services/bond-accrual.service.ts';
import { afterTax } from '@/features/net-worth/services/bond-tax.service.ts';
import { maturityOf } from '@/features/net-worth/services/bond-maturity.service.ts';

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
  /**
   * What the holdings themselves are worth on that day — the line the chart draws.
   *
   * Not `capital + interest`: interest a paying bond sent to somebody's account is money it earned
   * and is not part of what the bond is worth. The two lines answer different questions and this
   * is the one net worth agrees with.
   */
  worth: number;
  /** What would be left of `worth` after tax, holding by holding — see `bond-tax.service`. */
  net: number;
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
 * The currency this chart is drawn in, and how many holdings that leaves out.
 *
 * **Drawn in the bonds' own currency, never converted.** A point ten years out would need an
 * exchange rate ten years out, and there is no honest way to have one. Converting only the history
 * and not the projection would put a kink in the line at today for a reason that has nothing to do
 * with the bonds.
 *
 * It used to filter by the *display* currency instead, which meant somebody reading their figures
 * in euro with a shelf full of złoty bonds got no chart at all — and no note either, because the
 * note lived inside the card that never rendered. Where holdings are split across currencies the
 * larger pile is drawn and the rest is counted out loud.
 */
export const holdingsToChart = (
  bonds: DBBondHolding[]
): { currency: Currency | undefined; included: DBBondHolding[]; excluded: number } => {
  if (bonds.length === 0) return { currency: undefined, included: [], excluded: 0 };

  const capitalByCurrency = new Map<Currency, number>();

  for (const bond of bonds) {
    const capital = bond.quantity * bond.nominal;
    capitalByCurrency.set(bond.currency, (capitalByCurrency.get(bond.currency) ?? 0) + capital);
  }

  const [currency] = [...capitalByCurrency.entries()].sort((a, b) => b[1] - a[1])[0];
  const included = bonds.filter((bond) => bond.currency === currency);

  return { currency, included, excluded: bonds.length - included.length };
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

    // Valued at the redemption day once it is past: a bond that has been paid back does not go on
    // compounding, and drawing it as if it did turned a ten-year holding into a curve that ran off
    // the end of the chart. It leaves the series rather than dropping to zero on that day — the
    // money is still the person's, it is simply in an account now and not in a bond.
    const valuedOnDay = (bond: DBBondHolding) => {
      const maturity = maturityOf(bond);

      return maturity && on > maturity ? maturity : on;
    };

    const values = held.map((bond) => bondValueOn(bond, valuedOnDay(bond)));

    return {
      on: month,
      capital: round(values.reduce((total, value) => total + value.capital, 0)),
      interest: round(values.reduce((total, value) => total + value.accrued + value.paidOut, 0)),
      worth: round(values.reduce((total, value) => total + value.value, 0)),
      net: round(
        held.reduce(
          (total, bond) => total + afterTax(bondValueOn(bond, valuedOnDay(bond)), bond.wrapper),
          0
        )
      ),
      projected: month > currentMonth,
    };
  });
};
