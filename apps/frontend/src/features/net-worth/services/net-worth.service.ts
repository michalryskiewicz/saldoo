import type { DBPosition } from '@/database/positions.ts';

export type NetWorth = {
  /** Everything held. */
  held: number;
  /** Everything owed. */
  owed: number;
  /** The first less the second, which is allowed to be negative. */
  net: number;
};

const round = (amount: number) => Number(amount.toFixed(2));

const sumOf = (positions: DBPosition[], kind: DBPosition['kind']) =>
  positions.filter((position) => position.kind === kind).reduce((total, one) => total + one.value, 0);

/**
 * What is held, less what is owed.
 *
 * **It is allowed to be negative**, and clamping it would be the app deciding somebody's position
 * is too uncomfortable to print. Owing more than you hold is an ordinary situation, most of a
 * mortgage's life is exactly that, and a figure that refuses to say so is not a figure.
 *
 * Every position must already be in one currency — the same rule as everywhere else in this app:
 * conversion happens before the arithmetic, at the rate of each record's own date, never after.
 */
export const netWorth = (positions: DBPosition[]): NetWorth => {
  const held = round(sumOf(positions, 'asset'));
  const owed = round(sumOf(positions, 'liability'));

  return { held, owed, net: round(held - owed) };
};

/**
 * The oldest valuation among them, which is how old the whole figure is.
 *
 * A net worth is only as current as its stalest part. Somebody who updated one account yesterday
 * and another eight months ago has an eight-month-old number, and a tile that reads as freshly
 * true is worse than one that admits its age.
 */
export const stalestValuation = (positions: DBPosition[]): Date | undefined =>
  positions
    .map((position) => new Date(position.valuedOn))
    .reduce<Date | undefined>(
      (oldest, day) => (!oldest || day < oldest ? day : oldest),
      undefined
    );
