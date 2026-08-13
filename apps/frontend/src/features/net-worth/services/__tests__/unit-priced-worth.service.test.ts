import { describe, expect, it } from 'vitest';
import { ASSET_TYPE } from '@/constant.ts';
import { isPricedPerUnit, worthFromUnits } from '../unit-priced-worth.service.ts';

describe('isPricedPerUnit', () => {
  /**
   * The form asks for units where units are how somebody knows what they hold, and does not where
   * asking would be inventing a question — a savings account has no unit price.
   */
  it('is true of the things bought in units', () => {
    expect(isPricedPerUnit(ASSET_TYPE.ETF)).toBe(true);
    expect(isPricedPerUnit(ASSET_TYPE.STOCKS)).toBe(true);
  });

  it('is false of everything else', () => {
    expect(isPricedPerUnit(ASSET_TYPE.SAVINGS_ACCOUNT)).toBe(false);
    expect(isPricedPerUnit(ASSET_TYPE.CASH)).toBe(false);
    expect(isPricedPerUnit(ASSET_TYPE.BONDS)).toBe(false);
  });

  /** A holding whose type nobody has said is not asked for units either. */
  it('is false where no type was said', () => {
    expect(isPricedPerUnit(undefined)).toBe(false);
  });
});

describe('worthFromUnits', () => {
  /**
   * One stored figure remains the truth every screen reads, and the count and the price record how it
   * was arrived at. Two independently stored numbers that ought to agree are two numbers that will
   * one day disagree, and nothing would say which to believe.
   */
  it('is the count times the price', () => {
    expect(worthFromUnits({ units: 100, unitPrice: 4.32 })).toBe(432);
  });

  it('rounds as money rather than as floating point', () => {
    // 3 × 1.15 is 3.4499999999999997 in binary.
    expect(worthFromUnits({ units: 3, unitPrice: 1.15 })).toBe(3.45);
  });

  it('is nothing where either half is missing', () => {
    expect(worthFromUnits({ units: 100 })).toBeUndefined();
    expect(worthFromUnits({ unitPrice: 4.32 })).toBeUndefined();
    expect(worthFromUnits({})).toBeUndefined();
  });

  /**
   * Nought units is a real answer — somebody who sold everything holds none of it — and it has to
   * mean nought rather than being read as "not said" and leaving the old figure standing.
   */
  it('reads nought units as being worth nothing', () => {
    expect(worthFromUnits({ units: 0, unitPrice: 4.32 })).toBe(0);
  });
});
