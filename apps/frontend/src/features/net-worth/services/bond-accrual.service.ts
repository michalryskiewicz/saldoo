import { addMonths, addYears, differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns';
import type { DBBondHolding } from '@/database/bonds.ts';

/** A holding priced for the day, in its own currency, ready to be converted like any other record. */
export type ValuedBond = {
  id: string;
  currency: DBBondHolding['currency'];
  value: number;
  /** The day it was priced for — the date any conversion of `value` must use. */
  valuedOn: Date;
};

export type BondValue = {
  /** What was paid in — quantity times nominal. */
  capital: number;
  /** Interest from periods that have closed. It has joined the capital and compounds from there. */
  capitalised: number;
  /** Interest built up in the period still running, day by day. */
  accruing: number;
  /** Everything earned and still inside the bond: `capitalised` plus `accruing`. */
  accrued: number;
  /** Interest that has left for the person's account. Zero for one that compounds. */
  paidOut: number;
  /** What the holding itself is worth, which is the figure net worth wants. */
  value: number;
};

const round = (amount: number) => Number(amount.toFixed(2));

const PERIODS_PER_YEAR: Record<DBBondHolding['period'], number> = { monthly: 12, yearly: 1 };

/**
 * How many whole interest periods have closed.
 *
 * Whole ones, because this is the count of times interest has been *credited* — capitalised into
 * the bond or paid into an account. What has built up since the last one is a separate figure and
 * is not rounded away; see `accrualFraction`.
 */
export const periodsElapsed = (holding: DBBondHolding, on: Date): number => {
  const months = differenceInCalendarMonths(on, new Date(holding.boughtOn));
  const dayOfPurchase = new Date(holding.boughtOn).getDate();
  // A month is not complete until the day of the month it started on comes round again.
  const completedMonths = on.getDate() >= dayOfPurchase ? months : months - 1;

  if (completedMonths <= 0) return 0;

  return holding.period === 'monthly' ? completedMonths : Math.floor(completedMonths / 12);
};

const startOfPeriod = (holding: DBBondHolding, index: number): Date =>
  holding.period === 'monthly'
    ? addMonths(new Date(holding.boughtOn), index)
    : addYears(new Date(holding.boughtOn), index);

/**
 * How far through the current period a day sits, from 0 to 1.
 *
 * By the calendar rather than by an assumed 365, so a leap year and a 28-day February each divide
 * by the days they actually have. On the day a period turns over this is 0: the interest for the
 * period just gone has been credited, and the new one has earned nothing yet.
 */
export const accrualFraction = (holding: DBBondHolding, on: Date): number => {
  const completed = periodsElapsed(holding, on);
  const start = startOfPeriod(holding, completed);
  const end = startOfPeriod(holding, completed + 1);

  const elapsed = differenceInCalendarDays(on, start);
  const length = differenceInCalendarDays(end, start);

  if (elapsed <= 0 || length <= 0) return 0;

  return Math.min(1, elapsed / length);
};

/**
 * What a holding is worth on a day, and where the interest went.
 *
 * **Interest accrues daily.** A rate is announced per period and credited at its end, but the money
 * is earned as the days pass: redeem an EDO half way through its year and the issuer pays the
 * interest built up to that day, less a fee. A holding that reported its nominal until the
 * anniversary was telling somebody they had earned nothing when they had, and the figure it
 * refused to print is the one their own bank shows them.
 *
 * **The value here is gross.** An early redemption costs a fee — 2 zł per 100 zł on an EDO, never
 * more than the interest itself — and that fee is only owed by somebody who actually leaves early.
 * Netting it off every day would understate a bond held to term, which is what most of these are,
 * so the screen says the gross figure and names the fee beside it.
 *
 * **A bond that pays out does not grow past what it owes.** COI and ROR send each period's interest
 * to the person's account, so the holding keeps its nominal plus only the days since it last paid.
 * Counting what has already been paid would count the same złoty twice — once here and once as
 * money in the account it landed in.
 *
 * A bond compounds on its own interest, which is the whole reason to hold one for ten years: two
 * years of 6.55% on 10 000 is 11 352.90 against the 11 310 simple interest would give.
 */
export const bondValueOn = (holding: DBBondHolding, on: Date): BondValue => {
  const capital = round(holding.quantity * holding.nominal);
  const periods = periodsElapsed(holding, on);
  const ratePerPeriod = holding.ratePercent / 100 / PERIODS_PER_YEAR[holding.period];
  const fraction = accrualFraction(holding, on);

  if (holding.interest === 'pays out') {
    const accruing = round(capital * ratePerPeriod * fraction);

    return {
      capital,
      capitalised: 0,
      accruing,
      accrued: accruing,
      paidOut: round(capital * ratePerPeriod * periods),
      value: round(capital + accruing),
    };
  }

  const credited = round(capital * (1 + ratePerPeriod) ** periods);
  const accruing = round(credited * ratePerPeriod * fraction);

  return {
    capital,
    capitalised: round(credited - capital),
    accruing,
    accrued: round(credited - capital + accruing),
    paidOut: 0,
    value: round(credited + accruing),
  };
};

/**
 * Holdings priced for a day, each still in its own currency.
 *
 * The step that was missing: a bond's value used to go straight into a net worth printed in the
 * display currency, so a złoty bond added its figure to a euro total unconverted. Conversion in
 * this app happens **before** the arithmetic and at the rate of a record's own date, and a bond
 * priced today is a record dated today — so it can only be converted once it has been valued,
 * which is what this exists to make possible.
 */
export const valueBondsOn = (bonds: DBBondHolding[], on: Date): ValuedBond[] =>
  bonds.map((bond) => ({
    id: bond.id,
    currency: bond.currency,
    value: bondValueOn(bond, on).value,
    valuedOn: on,
  }));
