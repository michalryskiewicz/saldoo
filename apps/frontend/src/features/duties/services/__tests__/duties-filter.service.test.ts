import { describe, expect, it } from 'vitest';
import { selectVisibleDuties, sumPayableDuties } from '../duties-filter.service.ts';

const duty = (id: string, marks: { resolved?: boolean; ignored?: boolean } = {}) => ({
  id,
  ...marks,
  price: 100,
  expense: { expense: 100 },
});

const ALL = [duty('unpaid'), duty('paid', { resolved: true }), duty('skipped', { ignored: true })];

const idsOf = (duties: { id: string }[]) => duties.map((d) => d.id);

describe('selectVisibleDuties', () => {
  it('leaves a skipped occurrence out of what is still to pay', () => {
    expect(idsOf(selectVisibleDuties(ALL, 'unpaid'))).toEqual(['unpaid']);
  });

  it('leaves a skipped occurrence out of what was paid', () => {
    expect(idsOf(selectVisibleDuties(ALL, 'paid'))).toEqual(['paid']);
  });

  it('shows a skipped occurrence among all of them, where it can be taken back', () => {
    expect(idsOf(selectVisibleDuties(ALL, 'all'))).toEqual(['unpaid', 'paid', 'skipped']);
  });
});

describe('sumPayableDuties', () => {
  it('does not count what will not be paid', () => {
    expect(sumPayableDuties(ALL)).toBe(200);
  });

  /**
   * The resolved price, not the amount on the cost. They differ for a share of an income, whose
   * `expense` is zero and whose price depends on the month — and they differ for every row on a
   * screen showing a currency other than the one the cost was entered in, because conversion
   * rewrites the price and cannot reach a figure nested inside the cost.
   */
  it('adds the price on the row rather than the amount on the cost behind it', () => {
    const tax = { id: 'tax', price: 1200, expense: { expense: 0 } };
    const inEuro = { id: 'converted', price: 430, expense: { expense: 100 } };

    expect(sumPayableDuties([tax, inEuro])).toBe(1630);
  });
});
