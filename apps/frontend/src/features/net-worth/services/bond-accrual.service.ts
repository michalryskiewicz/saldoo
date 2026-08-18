import { differenceInCalendarMonths } from 'date-fns';
import type { DBBondHolding } from '@/database/bonds.ts';

export type BondValue = {
  /** What was paid in — quantity times nominal. */
  capital: number;
  /** Interest that has joined the capital. Zero for a bond that pays out. */
  accrued: number;
  /** Interest that has left for the person's account. Zero for one that compounds. */
  paidOut: number;
  /** What the holding itself is worth, which is the figure net worth wants. */
  value: number;
};

const round = (amount: number) => Number(amount.toFixed(2));

const PERIODS_PER_YEAR: Record<DBBondHolding['period'], number> = { monthly: 12, yearly: 1 };

/**
 * How many whole interest periods have gone by.
 *
 * **Whole ones only, and deliberately.** A rate is announced for a period and the interest is
 * credited at the end of it. Spreading it across the days between would print, to two decimal
 * places, a figure the bond does not have yet — about somebody's real money. A bond three hundred
 * days into its year is worth what it was worth on day one, and saying so is the honest answer.
 */
export const periodsElapsed = (holding: DBBondHolding, on: Date): number => {
  const months = differenceInCalendarMonths(on, new Date(holding.boughtOn));
  const dayOfPurchase = new Date(holding.boughtOn).getDate();
  // A month is not complete until the day of the month it started on comes round again.
  const completedMonths = on.getDate() >= dayOfPurchase ? months : months - 1;

  if (completedMonths <= 0) return 0;

  return holding.period === 'monthly' ? completedMonths : Math.floor(completedMonths / 12);
};

/**
 * What a holding is worth on a day, and where the interest went.
 *
 * **A bond that pays out does not grow.** COI and ROR send the interest to the person's account,
 * so the holding is still worth its nominal and the interest is income that has already arrived.
 * Adding both into net worth would count the same złoty twice — once as a bond that grew and once
 * as money in the account it was paid into.
 *
 * A bond that compounds does grow, and on the interest as well as on the capital: two years of
 * 6.55% on 10 000 is 11 352.90 against the 11 310 simple interest would give. Forty-three złoty
 * over two years, and the whole reason to hold one of these for ten.
 */
export const bondValueOn = (holding: DBBondHolding, on: Date): BondValue => {
  const capital = round(holding.quantity * holding.nominal);
  const periods = periodsElapsed(holding, on);
  const ratePerPeriod = holding.ratePercent / 100 / PERIODS_PER_YEAR[holding.period];

  if (holding.interest === 'pays out') {
    return {
      capital,
      accrued: 0,
      paidOut: round(capital * ratePerPeriod * periods),
      value: capital,
    };
  }

  const value = round(capital * (1 + ratePerPeriod) ** periods);

  return { capital, accrued: round(value - capital), paidOut: 0, value };
};
