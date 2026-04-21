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
