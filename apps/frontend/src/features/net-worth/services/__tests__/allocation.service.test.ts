import { describe, expect, it } from 'vitest';
import { ASSET_TYPE } from '@/constant.ts';
import { allocation, isTargetUsable, onlyChosenShares, targetSum } from '../allocation.service.ts';

const held = (value: number, assetType?: ASSET_TYPE) => ({ value, assetType });

describe('allocation', () => {
  /**
   * What an allocation is for: two people with the same net worth and different answers here are not
   * in the same position at all, and the figure that tells them apart is the share rather than the
   * amount.
   */
  it('is what share of the typed wealth each kind is', () => {
    const { parts } = allocation(
      [held(7500, ASSET_TYPE.ETF), held(2500, ASSET_TYPE.SAVINGS_ACCOUNT)],
      {}
    );

    expect(parts).toEqual([
      { assetType: ASSET_TYPE.ETF, value: 7500, share: 75, target: undefined, drift: undefined },
      {
        assetType: ASSET_TYPE.SAVINGS_ACCOUNT,
        value: 2500,
        share: 25,
        target: undefined,
        drift: undefined,
      },
    ]);
  });

  it('adds up several holdings of one kind', () => {
    const { parts } = allocation(
      [held(3000, ASSET_TYPE.ETF), held(4500, ASSET_TYPE.ETF), held(2500, ASSET_TYPE.CASH)],
      {}
    );

    expect(parts.find((part) => part.assetType === ASSET_TYPE.ETF)?.value).toBe(7500);
  });

  it('puts the biggest share first', () => {
    const { parts } = allocation(
      [held(1000, ASSET_TYPE.CASH), held(9000, ASSET_TYPE.ETF)],
      {}
    );

    expect(parts.map((part) => part.assetType)).toEqual([ASSET_TYPE.ETF, ASSET_TYPE.CASH]);
  });

  describe('against a target', () => {
    /** The whole point of setting one: the distance, signed, so over and under read differently. */
    it('says how far each kind is from where it was meant to be', () => {
      const { parts } = allocation([held(7500, ASSET_TYPE.ETF), held(2500, ASSET_TYPE.CASH)], {
        [ASSET_TYPE.ETF]: 60,
        [ASSET_TYPE.CASH]: 40,
      });

      expect(parts.find((part) => part.assetType === ASSET_TYPE.ETF)).toEqual({
        assetType: ASSET_TYPE.ETF,
        value: 7500,
        share: 75,
        target: 60,
        drift: 15,
      });
      expect(parts.find((part) => part.assetType === ASSET_TYPE.CASH)?.drift).toBe(-15);
    });

    /**
     * A kind somebody meant to hold and holds none of is the most useful row on the screen — leaving
     * it out would hide exactly the gap the target was set to reveal.
     */
    it('lists a kind that was aimed for and never bought', () => {
      const { parts } = allocation([held(10000, ASSET_TYPE.CASH)], {
        [ASSET_TYPE.CASH]: 50,
        [ASSET_TYPE.BONDS]: 50,
      });

      expect(parts.find((part) => part.assetType === ASSET_TYPE.BONDS)).toEqual({
        assetType: ASSET_TYPE.BONDS,
        value: 0,
        share: 0,
        target: 50,
        drift: -50,
      });
    });

    it('leaves the drift out where a kind has no target', () => {
      const { parts } = allocation([held(5000, ASSET_TYPE.ETF), held(5000, ASSET_TYPE.CASH)], {
        [ASSET_TYPE.ETF]: 100,
      });

      expect(parts.find((part) => part.assetType === ASSET_TYPE.CASH)?.drift).toBeUndefined();
    });
  });

  describe('what it will not pretend to know', () => {
    /**
     * Shares are of the *typed* wealth, and what is untyped is reported beside them rather than
     * folded in. Counted in, a half-classified account would report every kind as far below its
     * target — true of the wealth and useless as a reading of the allocation. Left out silently, the
     * percentages would quietly describe a fraction of somebody's money as though it were all of it.
     */
    it('reports what has no type instead of counting it', () => {
      const { parts, untyped } = allocation(
        [held(7500, ASSET_TYPE.ETF), held(2500, ASSET_TYPE.CASH), held(5000)],
        {}
      );

      expect(untyped).toBe(5000);
      expect(parts.find((part) => part.assetType === ASSET_TYPE.ETF)?.share).toBe(75);
    });

    it('says nothing at all where nothing has a type', () => {
      const { parts, untyped } = allocation([held(5000), held(1000)], {});

      expect(parts).toEqual([]);
      expect(untyped).toBe(6000);
    });

    it('says nothing about nothing', () => {
      expect(allocation([], {})).toEqual({ parts: [], untyped: 0 });
    });

    /** A holding worth nothing is not a share of anything and must not divide by nought. */
    it('survives holdings that are worth nothing', () => {
      const { parts } = allocation([held(0, ASSET_TYPE.ETF)], {});

      expect(parts).toEqual([]);
    });
  });
});

describe('targetSum', () => {
  it('adds up the shares somebody has set', () => {
    expect(targetSum({ [ASSET_TYPE.ETF]: 60, [ASSET_TYPE.CASH]: 40 })).toBe(100);
  });

  /** A kind left blank is a kind nobody aimed at, and must not read as a nought that counts. */
  it('ignores the kinds left blank', () => {
    expect(targetSum({ [ASSET_TYPE.ETF]: 60, [ASSET_TYPE.CASH]: undefined })).toBe(60);
  });

  it('is nought on an empty target', () => {
    expect(targetSum({})).toBe(0);
  });
});

describe('isTargetUsable', () => {
  it('accepts a target that comes to a hundred', () => {
    expect(isTargetUsable({ [ASSET_TYPE.ETF]: 60, [ASSET_TYPE.CASH]: 40 })).toBe(true);
  });

  /**
   * Empty is as valid as complete: it means nobody has chosen a target, and the allocation reads
   * perfectly well without one — only the distance needs an intention to measure against.
   */
  it('accepts no target at all', () => {
    expect(isTargetUsable({})).toBe(true);
  });

  it('refuses a target that comes to anything else', () => {
    expect(isTargetUsable({ [ASSET_TYPE.ETF]: 60 })).toBe(false);
    expect(isTargetUsable({ [ASSET_TYPE.ETF]: 60, [ASSET_TYPE.CASH]: 50 })).toBe(false);
  });
});

describe('onlyChosenShares', () => {
  /**
   * Absent and nought are different answers. A kind stored as nought says "I mean to hold none of
   * this", which the allocation would then report a drift against; a kind left out says nothing.
   */
  it('drops the kinds nobody aimed at', () => {
    expect(
      onlyChosenShares({
        [ASSET_TYPE.ETF]: 60,
        [ASSET_TYPE.CASH]: 40,
        [ASSET_TYPE.STOCKS]: undefined,
        [ASSET_TYPE.BONDS]: 0,
      })
    ).toEqual({ [ASSET_TYPE.ETF]: 60, [ASSET_TYPE.CASH]: 40 });
  });
});
