import { describe, expect, it } from 'vitest';
import type { BackableHolding } from '../goal-backing.service.ts';
import { assignedShare, backedValue, backingOf, unassignedValue } from '../goal-backing.service.ts';

const holding = (
  id: string,
  value: number,
  assignments: { goalId: string; share: number }[] = []
): BackableHolding => ({ id, description: id, value, assignments });

describe('backedValue', () => {
  it('is the share of each holding that works towards the goal', () => {
    const held = [holding('konto', 10000, [{ goalId: 'fund', share: 100 }])];

    expect(backedValue('fund', held)).toBe(10000);
  });

  it('takes only the share that was assigned', () => {
    const held = [holding('EDO0836', 20000, [{ goalId: 'fund', share: 60 }])];

    expect(backedValue('fund', held)).toBe(12000);
  });

  it('adds up everything pointed at the same goal', () => {
    const held = [
      holding('konto', 5000, [{ goalId: 'fund', share: 100 }]),
      holding('EDO0836', 20000, [{ goalId: 'fund', share: 25 }]),
    ];

    expect(backedValue('fund', held)).toBe(10000);
  });

  /** One holding can serve two ends, which is the ordinary case for an account. */
  it('splits a holding between the goals it was split between', () => {
    const held = [
      holding('konto', 10000, [
        { goalId: 'fund', share: 70 },
        { goalId: 'wakacje', share: 30 },
      ]),
    ];

    expect(backedValue('fund', held)).toBe(7000);
    expect(backedValue('wakacje', held)).toBe(3000);
  });

  it('is nothing for a goal nothing was pointed at', () => {
    expect(backedValue('wakacje', [holding('konto', 10000)])).toBe(0);
  });

  /**
   * A holding whose value went down takes its goals with it, and quietly. Somebody who spends out
   * of an account their emergency fund sits in has a smaller fund — the arithmetic is right and it
   * is the screen's job to say so out loud.
   */
  it('follows the holding down as well as up', () => {
    const held = [holding('konto', 4000, [{ goalId: 'fund', share: 100 }])];

    expect(backedValue('fund', held)).toBe(4000);
  });
});

describe('backingOf', () => {
  it('names what stands behind a goal, and for how much', () => {
    const held = [
      holding('konto', 10000, [{ goalId: 'fund', share: 50 }]),
      holding('EDO0836', 2000, [{ goalId: 'fund', share: 100 }]),
      holding('akcje', 9000, [{ goalId: 'wakacje', share: 100 }]),
    ];

    expect(backingOf('fund', held)).toEqual([
      { id: 'konto', description: 'konto', share: 50, value: 5000 },
      { id: 'EDO0836', description: 'EDO0836', share: 100, value: 2000 },
    ]);
  });

  /** Largest first: the card has room for a couple of names, and those are the ones worth the room. */
  it('puts the biggest backer first', () => {
    const held = [
      holding('drobne', 100, [{ goalId: 'fund', share: 100 }]),
      holding('konto', 10000, [{ goalId: 'fund', share: 100 }]),
    ];

    expect(backingOf('fund', held).map((one) => one.id)).toEqual(['konto', 'drobne']);
  });
});

describe('assignedShare', () => {
  it('is everything spoken for on one holding', () => {
    expect(
      assignedShare(
        holding('konto', 10000, [
          { goalId: 'fund', share: 70 },
          { goalId: 'wakacje', share: 20 },
        ])
      )
    ).toBe(90);
  });

  it('is nothing on a holding nobody has claimed', () => {
    expect(assignedShare(holding('konto', 10000))).toBe(0);
  });
});

describe('unassignedValue', () => {
  /**
   * The figure this whole idea exists to make sayable: money that is somewhere but is not for
   * anything. Printed rather than left as a subtraction the reader has to do themselves.
   */
  it('is what is left of everything once every claim is taken off', () => {
    const held = [
      holding('konto', 10000, [{ goalId: 'fund', share: 70 }]),
      holding('EDO0836', 2000, [{ goalId: 'fund', share: 100 }]),
      holding('akcje', 5000),
    ];

    expect(unassignedValue(held)).toBe(8000);
  });

  it('is everything when nothing has been assigned', () => {
    expect(unassignedValue([holding('konto', 10000)])).toBe(10000);
  });

  /**
   * Assignments adding past 100 are not arithmetic to be silently absorbed — they are a mistake
   * somebody made, and the honest answer is that nothing is free rather than that a negative
   * amount is.
   */
  it('never reports less than nothing when a holding was over-promised', () => {
    const held = [
      holding('konto', 10000, [
        { goalId: 'fund', share: 80 },
        { goalId: 'wakacje', share: 50 },
      ]),
    ];

    expect(unassignedValue(held)).toBe(0);
  });
});
