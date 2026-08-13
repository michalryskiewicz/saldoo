import { describe, expect, it } from 'vitest';
import { backingMoved } from '../backing-moved.service.ts';

const moved = (amount: number, since: string) => ({
  positionId: 'x',
  amount,
  currency: 'PLN' as const,
  since: new Date(since),
  on: new Date('2026-08-01'),
});

const holding = (
  id: string,
  value: number,
  assignments: { goalId: string; share: number }[] = [],
  change?: ReturnType<typeof moved>
) => ({ id, description: id, value, assignments, change });

describe('backingMoved', () => {
  /**
   * Why a goal's figure changed when the person did nothing. A holdings-funded goal reads an account,
   * so the account being spent out of takes the goal down with it — correct arithmetic that looks
   * like a bug, or worse like something they did, unless the screen names the cause.
   */
  it('is what the holdings behind the goal did', () => {
    const held = [
      holding('konto', 25000, [{ goalId: 'fund', share: 100 }], moved(-5000, '2026-05-01')),
    ];

    expect(backingMoved('fund', held)).toEqual({ amount: -5000, since: new Date('2026-05-01') });
  });

  it('adds up every holding behind the goal', () => {
    const held = [
      holding('konto', 20000, [{ goalId: 'fund', share: 100 }], moved(-5000, '2026-05-01')),
      holding('EDO', 5000, [{ goalId: 'fund', share: 100 }], moved(200, '2026-06-01')),
    ];

    expect(backingMoved('fund', held)?.amount).toBe(-4800);
  });

  /** A holding half-assigned moved the goal by half of what it did, exactly as it backs half of it. */
  it('takes only the share that was assigned', () => {
    const held = [
      holding('konto', 20000, [{ goalId: 'fund', share: 60 }], moved(-1000, '2026-05-01')),
    ];

    expect(backingMoved('fund', held)?.amount).toBe(-600);
  });

  /** The oldest reading it is measured from, so the sentence cannot claim a shorter window than it has. */
  it('measures from the earliest reading behind it', () => {
    const held = [
      holding('konto', 20000, [{ goalId: 'fund', share: 100 }], moved(-5000, '2026-05-01')),
      holding('EDO', 5000, [{ goalId: 'fund', share: 100 }], moved(200, '2026-02-01')),
    ];

    expect(backingMoved('fund', held)?.since).toEqual(new Date('2026-02-01'));
  });

  it('ignores holdings behind other goals', () => {
    const held = [
      holding('konto', 20000, [{ goalId: 'wakacje', share: 100 }], moved(-5000, '2026-05-01')),
    ];

    expect(backingMoved('fund', held)).toBeUndefined();
  });

  /**
   * Nothing where nothing moved. A goal whose holdings have each been valued once has no before to
   * have moved from, and nought would read as "it held steady" — a claim nobody made.
   */
  it('says nothing where no holding behind it has a previous reading', () => {
    const held = [holding('konto', 20000, [{ goalId: 'fund', share: 100 }])];

    expect(backingMoved('fund', held)).toBeUndefined();
  });

  it('says nothing where the moves cancel out', () => {
    // Not zero: a figure that has not moved on the whole is not a consequence worth a sentence.
    const held = [
      holding('a', 1000, [{ goalId: 'fund', share: 100 }], moved(-500, '2026-05-01')),
      holding('b', 1000, [{ goalId: 'fund', share: 100 }], moved(500, '2026-05-01')),
    ];

    expect(backingMoved('fund', held)).toBeUndefined();
  });

  it('says nothing about a goal nothing is pointed at', () => {
    expect(backingMoved('fund', [])).toBeUndefined();
  });
});
