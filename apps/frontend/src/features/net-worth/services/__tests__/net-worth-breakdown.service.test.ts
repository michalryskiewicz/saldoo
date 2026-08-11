import { describe, expect, it } from 'vitest';
import type { DBPosition } from '@/database/positions.ts';
import { netWorthBreakdown, OTHER_SEGMENT } from '../net-worth-breakdown.service.ts';

const position = (description: string, value: number, kind: DBPosition['kind'] = 'asset') =>
  ({
    id: description,
    description,
    kind,
    value,
    currency: 'PLN',
    valuedOn: new Date(2026, 7, 1),
    createdAt: new Date(2026, 7, 1),
  }) as DBPosition;

describe('netWorthBreakdown', () => {
  it('puts what is held on one side and what is owed on the other', () => {
    const { held, owed, totals } = netWorthBreakdown(
      [position('Konto', 12000), position('Kredyt', 250000, 'liability')],
      []
    );

    expect(held.map((one) => one.label)).toEqual(['Konto']);
    expect(owed.map((one) => one.label)).toEqual(['Kredyt']);
    expect(totals).toEqual({ held: 12000, owed: 250000, net: -238000 });
  });

  /**
   * A net worth is allowed to be negative, and clamping it would be the app deciding somebody's
   * position is too uncomfortable to print. Most of a mortgage's life is exactly this.
   */
  it('lets the balance be negative', () => {
    const { totals } = netWorthBreakdown([position('Kredyt', 400000, 'liability')], []);

    expect(totals.net).toBe(-400000);
  });

  /**
   * Bonds arrive as one segment rather than one per holding: the table underneath already lists
   * them, and a chart answering "what is this made of" should not spend seven colours on the part
   * that has its own screen. They come in already priced and already converted — what each is
   * worth is `bond-accrual`'s question.
   */
  it('folds every bond into a single segment', () => {
    const { held } = netWorthBreakdown([position('Konto', 1000)], [1000, 500]);

    const bonds = held.find((one) => one.key === 'bonds');

    expect(bonds?.value).toBe(1500);
  });

  it('leaves the bonds segment out entirely when none are held', () => {
    const { held } = netWorthBreakdown([position('Konto', 1000)], []);

    expect(held.some((one) => one.key === 'bonds')).toBe(false);
  });

  it('orders each side by size, so the largest thing is read first', () => {
    const { held } = netWorthBreakdown(
      [position('Małe', 100), position('Duże', 9000), position('Średnie', 3000)],
      []
    );

    expect(held.map((one) => one.label)).toEqual(['Duże', 'Średnie', 'Małe']);
  });

  /**
   * Past a handful of segments a stacked bar stops being read and starts being decoded, so the tail
   * is gathered into one. The figure is unaffected — what is dropped is the distinction between
   * things too small to see, not their value.
   */
  it('gathers the tail into one segment rather than growing a rainbow', () => {
    const many = Array.from({ length: 9 }, (_, index) => position(`P${index}`, 100 - index));

    const { held, totals } = netWorthBreakdown(many, []);

    expect(held).toHaveLength(6);
    expect(held.at(-1)!.key).toBe(OTHER_SEGMENT);
    expect(held.reduce((sum, one) => sum + one.value, 0)).toBe(totals.held);
  });

  it('is empty on both sides when nothing is held or owed', () => {
    expect(netWorthBreakdown([], [])).toEqual({
      held: [],
      owed: [],
      totals: { held: 0, owed: 0, net: 0 },
    });
  });
});
