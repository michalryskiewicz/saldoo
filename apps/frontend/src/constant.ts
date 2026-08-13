export const TOTAL = 'TOTAL';
export const NEW_ENTITY_ID = 'NEW_ENTITY_ID';

export enum SEVERITY {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum FREQUENCY {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export type Currency = 'PLN' | 'EUR' | 'USD';

/**
 * What kind of thing a holding is — the question `kind` cannot answer.
 *
 * `kind` says held or owed. This says *what* is held, which is what an allocation is a breakdown of:
 * somebody with everything in a savings account and somebody with everything in shares have the same
 * net worth and are not in remotely the same position.
 *
 * **Absent on a holding nobody has said it of.** Every position that existed before this was added
 * has no type, and guessing one would put money into a bucket the person never chose — so an
 * allocation counts those apart and says so rather than quietly calling them "other".
 */
export enum ASSET_TYPE {
  CASH = 'CASH',
  REAL_ESTATE = 'REAL_ESTATE',
  PRECIOUS_METALS = 'PRECIOUS_METALS',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  SAVINGS_ACCOUNT = 'SAVINGS_ACCOUNT',
  BONDS = 'BONDS',
  ETF = 'ETF',
  STOCKS = 'STOCKS',
  CURRENCIES = 'CURRENCIES',
  OTHER = 'OTHER',
}

/**
 * The types whose worth is naturally a count times a price.
 *
 * "100 × 4,32" is how somebody actually knows what an ETF holding is worth; one figure typed in is a
 * multiplication they did in their head and cannot check later. A savings account has no units, and
 * asking for them would be a form inventing a question.
 */
export const PRICED_PER_UNIT: readonly ASSET_TYPE[] = [ASSET_TYPE.ETF, ASSET_TYPE.STOCKS];

export enum STRATEGY_PART {
  NEEDS = 'NEEDS',
  WANTS = 'WANTS',
  SAVINGS = 'SAVINGS',
  DEBTS = 'DEBTS',
  NEEDS_AND_WANTS = 'NEEDS_AND_WANTS',
  SHORT_TERM_SAVINGS = 'SHORT_TERM_SAVINGS',
  LONG_TERM_SAVINGS = 'LONG_TERM_SAVINGS',
}

export const BUDGETING_STRATEGIES = {
  FIFTY_THIRTY_TWENTY: [
    { type: STRATEGY_PART.NEEDS, expanses: 50, fill: `var(--color-${STRATEGY_PART.NEEDS})` },
    { type: STRATEGY_PART.WANTS, expanses: 30, fill: `var(--color-${STRATEGY_PART.WANTS})` },
    { type: STRATEGY_PART.SAVINGS, expanses: 20, fill: `var(--color-${STRATEGY_PART.SAVINGS})` },
  ],
  FIFTY_TWENTY_THIRTY: [
    { type: STRATEGY_PART.NEEDS, expanses: 50, fill: `var(--color-${STRATEGY_PART.NEEDS})` },
    { type: STRATEGY_PART.WANTS, expanses: 20, fill: `var(--color-${STRATEGY_PART.WANTS})` },
    { type: STRATEGY_PART.SAVINGS, expanses: 30, fill: `var(--color-${STRATEGY_PART.SAVINGS})` },
  ],
  SIXTY_THIRTY_TEN: [
    { type: STRATEGY_PART.NEEDS, expanses: 60, fill: `var(--color-${STRATEGY_PART.NEEDS})` },
    { type: STRATEGY_PART.WANTS, expanses: 30, fill: `var(--color-${STRATEGY_PART.WANTS})` },
    { type: STRATEGY_PART.SAVINGS, expanses: 10, fill: `var(--color-${STRATEGY_PART.SAVINGS})` },
  ],

  EIGHTY_TWENTY: [
    {
      type: STRATEGY_PART.NEEDS_AND_WANTS,
      expanses: 80,
      fill: `var(--color-${STRATEGY_PART.NEEDS_AND_WANTS}`,
    },
    { type: STRATEGY_PART.SAVINGS, expanses: 20, fill: `var(--color-${STRATEGY_PART.SAVINGS})` },
  ],
  SEVENTY_TWENTY_TEN: [
    {
      type: STRATEGY_PART.NEEDS_AND_WANTS,
      expanses: 70,
      fill: `var(--color-${STRATEGY_PART.NEEDS_AND_WANTS}`,
    },
    { type: STRATEGY_PART.SAVINGS, expanses: 20, fill: `var(--color-${STRATEGY_PART.SAVINGS})` },
    { type: STRATEGY_PART.DEBTS, expanses: 10, fill: `var(--color-${STRATEGY_PART.DEBTS})` },
  ],

  TEN_TEN_TEN_SEVENTY: [
    {
      type: STRATEGY_PART.NEEDS_AND_WANTS,
      expanses: 70,
      fill: `var(--color-${STRATEGY_PART.NEEDS_AND_WANTS}`,
    },
    {
      type: STRATEGY_PART.LONG_TERM_SAVINGS,
      expanses: 10,
      fill: `var(--color-${STRATEGY_PART.LONG_TERM_SAVINGS})`,
    },
    {
      type: STRATEGY_PART.SHORT_TERM_SAVINGS,
      expanses: 10,
      fill: `var(--color-${STRATEGY_PART.SHORT_TERM_SAVINGS})`,
    },
    { type: STRATEGY_PART.DEBTS, expanses: 10, fill: `var(--color-${STRATEGY_PART.DEBTS})` },
  ],
};
