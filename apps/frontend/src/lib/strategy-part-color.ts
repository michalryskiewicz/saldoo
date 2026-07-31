import { STRATEGY_PART } from '@/constant.ts';

/**
 * The colour each part of a budget strategy is drawn in.
 *
 * Held here rather than inside the chart's own config, because two places now need it: the
 * strategy pie and the form control that picks a part. A colour mapping kept in a chart config is
 * reachable only from inside a `ChartContainer` — it is that container which emits the
 * `--color-<key>` variables, which is why `var(--color-NEEDS)` resolves to nothing anywhere else
 * and why a second copy would otherwise have been written by hand.
 *
 * The assignment is per part and fixed. A part must not change colour because the strategy above
 * it has fewer slices this time.
 */
export const STRATEGY_PART_COLOR: Record<STRATEGY_PART, string> = {
  [STRATEGY_PART.NEEDS]: 'var(--chart-1)',
  [STRATEGY_PART.WANTS]: 'var(--chart-2)',
  [STRATEGY_PART.SAVINGS]: 'var(--chart-3)',
  [STRATEGY_PART.NEEDS_AND_WANTS]: 'var(--chart-4)',
  [STRATEGY_PART.DEBTS]: 'var(--chart-5)',
  [STRATEGY_PART.LONG_TERM_SAVINGS]: 'var(--chart-6)',
  [STRATEGY_PART.SHORT_TERM_SAVINGS]: 'var(--chart-7)',
};
