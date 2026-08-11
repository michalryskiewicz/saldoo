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

/**
 * Bonds arrive here as amounts, already priced by `bond-accrual` and already converted into the
 * currency the positions are in. What each one is *worth* is that service's question and is tested
 * there; what is left here is that a holding whose value is computed still lands on the held side.
 */
describe('bonds in net worth', () => {
  it('adds what the bonds are worth to what is held', () => {
    const totals = netWorthWithBonds([], [10655]);

    expect(totals.held).toBe(10655);
    expect(totals.net).toBe(10655);
  });

  it('adds them to what was entered by hand', () => {
    expect(netWorthWithBonds([held('Konto', 5000)], [10655]).held).toBe(15655);
  });

  it('leaves what is owed alone: a bond is never a liability', () => {
    const totals = netWorthWithBonds([owed('Kredyt', 400000)], [10655]);

    expect(totals.owed).toBe(400000);
    expect(totals.net).toBe(-389345);
  });
});
