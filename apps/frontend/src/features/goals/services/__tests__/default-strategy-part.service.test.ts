import { describe, expect, it } from 'vitest';
import { STRATEGY_PART } from '@/constant.ts';
import { defaultStrategyPart } from '../default-strategy-part.service.ts';

describe('defaultStrategyPart', () => {
  /**
   * A goal is money set aside, so savings is the answer for almost all of them. Taking the
   * strategy's first part instead landed every unedited goal under "needs" — out of the tile it
   * belongs in, on a screen that had just been taught to count goals as savings.
   */
  it('is savings when the strategy has a savings part', () => {
    const options = [
      { value: STRATEGY_PART.NEEDS },
      { value: STRATEGY_PART.WANTS },
      { value: STRATEGY_PART.SAVINGS },
    ];

    expect(defaultStrategyPart(options)).toBe(STRATEGY_PART.SAVINGS);
  });

  it('takes what is offered when the parts are merged', () => {
    const options = [{ value: STRATEGY_PART.NEEDS_AND_WANTS }, { value: STRATEGY_PART.SAVINGS }];

    expect(defaultStrategyPart(options)).toBe(STRATEGY_PART.SAVINGS);
  });

  /** No strategy chosen yet: nothing to default to, and inventing one would type into an empty form. */
  it('is nothing when there is nothing to choose from', () => {
    expect(defaultStrategyPart([])).toBeUndefined();
  });
});
