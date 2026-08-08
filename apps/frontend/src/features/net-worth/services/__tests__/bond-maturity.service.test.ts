import { describe, expect, it } from 'vitest';
import type { DBBondHolding } from '@/database/bonds.ts';
import { maturityOf, lastMaturity } from '../bond-maturity.service.ts';

const bought = (fields: Partial<DBBondHolding> = {}): DBBondHolding =>
  ({
    id: 'b1',
    description: 'EDO0335',
    quantity: 100,
    nominal: 100,
    boughtOn: new Date(2025, 2, 10),
    ratePercent: 6.55,
    interest: 'compounds',
    period: 'yearly',
    currency: 'PLN',
    ...fields,
  }) as DBBondHolding;

describe('maturityOf', () => {
  /**
   * Read out of the published name, where the issuer already put it: a ten-year sold in March 2025
   * is called EDO0335 because it is redeemed in March 2035. Nothing has to be stored for this.
   */
  it('is the month the series name says it is redeemed in', () => {
    const day = maturityOf(bought())!;

    expect(day.getFullYear()).toBe(2035);
    expect(day.getMonth()).toBe(2);
  });

  it('reads a three-year the same way', () => {
    expect(maturityOf(bought({ description: 'TOS0528' }))!.getFullYear()).toBe(2028);
  });

  /**
   * A holding whose name nobody can parse — typed by hand, or from before the app named them — has
   * no maturity to offer. Guessing one from the purchase date would invent a tenor.
   */
  it('is nothing at all when the name carries no series', () => {
    expect(maturityOf(bought({ description: 'Obligacje z banku' }))).toBeUndefined();
  });
});

describe('lastMaturity', () => {
  it('is the furthest one out, which is how long a chart has anything to draw', () => {
    const day = lastMaturity([bought({ description: 'TOS0528' }), bought({ description: 'EDO0335' })])!;

    expect(day.getFullYear()).toBe(2035);
  });

  it('is nothing when nothing can be dated', () => {
    expect(lastMaturity([bought({ description: 'Obligacje z banku' })])).toBeUndefined();
  });

  it('is nothing when there is nothing at all', () => {
    expect(lastMaturity([])).toBeUndefined();
  });
});
