import { STRATEGY_PART } from '@/constant.ts';

type Option = { value: string };

/**
 * Which part of the budgeting strategy a new goal starts on.
 *
 * **Savings, where the strategy has them.** The form used to take whatever the strategy listed
 * first, which for 50-30-20 is needs — so a goal nobody edited landed under "needs" and quietly
 * stayed out of the savings tile it belongs in. A goal is money set aside by definition; needs is
 * the answer for the rare goal that is one (a new boiler), and it is still one click away.
 *
 * Falls back to the first part offered, because a strategy with the parts merged has no savings to
 * pick — `EIGHTY_TWENTY` and its kin carry `NEEDS_AND_WANTS` — and a default that resolves to
 * nothing would leave the field empty on a form that requires it.
 */
export const defaultStrategyPart = (options: Option[]): string | undefined =>
  options.find((option) => option.value === STRATEGY_PART.SAVINGS)?.value ?? options[0]?.value;
