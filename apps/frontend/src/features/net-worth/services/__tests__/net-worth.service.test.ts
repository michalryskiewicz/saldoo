import { describe, expect, it } from 'vitest';
import type { DBPosition } from '@/database/positions.ts';
import { netWorth, netWorthWithBonds, stalestValuation } from '../net-worth.service.ts';

const held = (description: string, value: number): DBPosition =>
  ({
    id: description,
    description,
    kind: 'asset',
    value,
    currency: 'PLN',
    valuedOn: new Date(2026, 6, 1),
  }) as DBPosition;

const owed = (description: string, value: number): DBPosition =>
  ({ ...held(description, value), kind: 'liability' }) as DBPosition;

describe('netWorth', () => {
  it('is what is held less what is owed', () => {
    const total = netWorth([held('IKE', 31000), held('Konto', 12000), owed('Kredyt', 18000)]);

    expect(total).toEqual({ held: 43000, owed: 18000, net: 25000 });
  });

  /**
   * Owing more than you hold is a real situation and not an error state. The figure goes negative
   * and says so; clamping it at zero would be the app deciding somebody's position is too
   * uncomfortable to print.
   */
  it('goes negative rather than pretending', () => {
    expect(netWorth([held('Konto', 2000), owed('Kredyt', 9000)]).net).toBe(-7000);
  });

  it('is nothing at all before anything has been entered', () => {
    expect(netWorth([])).toEqual({ held: 0, owed: 0, net: 0 });
  });
});

describe('stalestValuation', () => {
  /**
   * A net worth figure is only as current as its oldest part. Somebody who updated one account
   * yesterday and another eight months ago has an eight-month-old number, and the tile has to be
   * able to say so rather than looking freshly true.
   */
  it('is the oldest of them, because that is how old the figure is', () => {
    const positions = [
      { ...held('Konto', 1000), valuedOn: new Date(2026, 6, 1) },
      { ...held('IKE', 31000), valuedOn: new Date(2025, 10, 3) },
    ];

    expect(stalestValuation(positions)).toEqual(new Date(2025, 10, 3));
  });

  it('has nothing to report when there is nothing to value', () => {
    expect(stalestValuation([])).toBeUndefined();
  });
});

describe('bonds in net worth', () => {
  const edo = {
    id: 'b1',
    description: 'EDO0335',
    quantity: 100,
    nominal: 100,
    boughtOn: new Date(2025, 2, 10),
    ratePercent: 6.55,
    interest: 'compounds',
    period: 'yearly',
    currency: 'PLN',
  } as unknown as import('@/database/bonds.ts').DBBondHolding;

  /**
   * A bond is held, so it counts — but at what it is *worth today*, computed, rather than at what
   * was paid for it. That is the whole difference between this and typing a number in.
   */
  it('counts what a bond is worth today, not what it cost', () => {
    const totals = netWorthWithBonds([], [edo], new Date(2026, 2, 10));

    expect(totals.held).toBe(10655);
    expect(totals.net).toBe(10655);
  });

  it('adds them to what was entered by hand', () => {
    const totals = netWorthWithBonds([held('Konto', 5000)], [edo], new Date(2026, 2, 10));

    expect(totals.held).toBe(15655);
  });

  /**
   * A bond that pays its interest out is worth its nominal and no more. The interest is in the
   * account it was paid into, and that account is a position of its own — counting the bond as
   * grown as well would be the same złoty twice.
   */
  it('does not grow a bond that pays its interest out', () => {
    const coi = { ...edo, interest: 'pays out' as const };

    expect(netWorthWithBonds([], [coi], new Date(2027, 2, 10)).held).toBe(10000);
  });
});
