import { describe, expect, it } from 'vitest';
import { selectVisibleDuties, sumPayableDuties } from '../duties-filter.service.ts';

const duty = (id: string, marks: { resolved?: boolean; ignored?: boolean } = {}) => ({
  id,
  ...marks,
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
});
