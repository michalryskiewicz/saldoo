import { addMonths, endOfMonth } from 'date-fns';
import i18n from '@/i18n.ts';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBProfit } from '@/database/profits.ts';

/** The incomes a share is actually taken of — those of them that are still there to be found. */
const baseOf = (expense: DBExpense, profits: DBProfit[]): DBProfit[] =>
  profits.filter((profit) => expense.percentageOfIncome?.profitIds.includes(profit.id));

/**
 * Whether the income a cost is a share of has been deleted out from under it.
 *
 * A deleted income and an ended one are different situations, and only this one has no honest
 * arithmetic left. An ended income is still there to be found, so the cost inherits its ending and
 * keeps every occurrence it recorded. A deleted one leaves nothing: 12% of a base that cannot be
 * found is zero, and reporting zero would put a figure that looks like an answer where there is
 * none — so the cost says this instead, and generates nothing.
 *
 * Only when **none** of them can be found. Losing one income out of several is an ordinary thing —
 * a client gone — and the tax on the rest is still real; refusing to compute it would be inventing
 * a second failure out of the first.
 */
export const hasLostItsBase = (expense: DBExpense, profits: DBProfit[]): boolean =>
  Boolean(expense.percentageOfIncome) && baseOf(expense, profits).length === 0;

/**
 * The day a cost that is a share of an income stops recurring, because its income has.
 *
 * A client leaves in March, so the last invoice is a March one and the last tax on it falls in
 * April. The alternative — leaving the cost running against a base that is now zero — is the
 * silent-zero failure: a figure that looks like an answer and is not one.
 *
 * **The end of the month, not the same day of it.** The income's last day is the 10th and the tax
 * has its own day, the 20th; shifting the day across would cut the series ten days before the
 * occurrence it exists to cover. What is inherited is *which month is the last one*.
 *
 * The latest of them, when the share is of several incomes: one client leaving does not end a tax
 * the others still generate.
 *
 * `undefined` while any of them goes on, which is what an income with no ending of its own means —
 * there is nothing to inherit, and the cost keeps whatever ending it was given.
 */
export const endsWithItsIncome = (
  expense: DBExpense,
  profits: DBProfit[]
): Date | undefined => {
  const share = expense.percentageOfIncome;

  if (!share) return undefined;

  const base = baseOf(expense, profits);

  if (!base.length || base.some((profit) => !profit.endsAt)) return undefined;

  const lastDay = base
    .map((profit) => new Date(profit.endsAt as Date))
    .reduce((latest, day) => (day > latest ? day : latest));

  return endOfMonth(share.basePeriod === 'thisMonth' ? lastDay : addMonths(lastDay, 1));
};

/**
 * A share, in words, for the column that would otherwise show the amount.
 *
 * That column reads `expense`, which for a share is zero — the number stored, and not the truth: a
 * share has no amount at all until a month is named. What it does have is what it is a share *of*,
 * so that is what the row says.
 *
 * Every income named rather than counted. "12% z 3 przychodów" tells the reader nothing about which
 * three, and this is the figure the whole cost is built from.
 *
 * When none of them can be found the row says so. Naming nothing would read as a share of
 * everything, and printing 12% beside an empty base is the silent zero all over again.
 */
export const describeShare = (expense: DBExpense, profits: DBProfit[]): string | undefined => {
  const share = expense.percentageOfIncome;

  if (!share) return undefined;

  const named = baseOf(expense, profits).map((profit) => profit.description);

  if (!named.length) return `${share.percent}% — ${i18n.t('amount_mode.base-gone')}`;

  return `${share.percent}% ${i18n.t('amount_mode.of')} ${named.join(', ')}`;
};
