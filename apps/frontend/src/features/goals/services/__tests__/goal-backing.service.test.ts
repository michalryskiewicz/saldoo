import { describe, expect, it } from 'vitest';
import type { BackableHolding } from '../goal-backing.service.ts';
import {
  assignedShare,
  backedValue,
  backingOf,
  freeValue,
  goalsNowReadingHoldings,
  unassignedValue,
} from '../goal-backing.service.ts';

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

describe('freeValue', () => {
  /**
   * The figure worth saying, or nothing at all.
   *
   * On an account where nobody has assigned anything, what is free *is* what is held — and printing
   * both beside each other on one tile says the same fact twice, which teaches the reader that the
   * line carries no information. It has something to say from the first assignment onwards.
   */
  it('is the unassigned amount once anything has been assigned', () => {
    const held = [
      holding('konto', 10000, [{ goalId: 'fund', share: 60 }]),
      holding('skarbonka', 2000),
    ];

    expect(freeValue(held)).toBe(6000);
  });

  it('is nothing at all while no holding has been pointed at a goal', () => {
    expect(freeValue([holding('konto', 10000), holding('skarbonka', 2000)])).toBeUndefined();
  });

  it('is nothing at all on an account holding nothing', () => {
    expect(freeValue([])).toBeUndefined();
  });

  /** A share of nought is not an assignment, and the tile stays quiet for it. */
  it('does not count a holding assigned nought per cent as pointed anywhere', () => {
    expect(freeValue([holding('konto', 10000, [{ goalId: 'fund', share: 0 }])])).toBeUndefined();
  });
});

describe('goalsNowReadingHoldings', () => {
  const goal = (id: string, funding: 'contributions' | 'holdings') => ({ id, funding });

  /**
   * A goal reads declarations or holdings, never both, because the two are the same złoty seen from
   * two ends. Pointing an account at a goal is the moment somebody says where the money actually
   * is, so it is the moment the goal should stop guessing from what was typed in.
   */
  it('names a goal that was still reading declarations', () => {
    expect(
      goalsNowReadingHoldings([{ goalId: 'ike', share: 100 }], [goal('ike', 'contributions')])
    ).toEqual(['ike']);
  });

  it('leaves alone a goal that already reads its holdings', () => {
    expect(
      goalsNowReadingHoldings([{ goalId: 'ike', share: 100 }], [goal('ike', 'holdings')])
    ).toEqual([]);
  });

  it('names every goal the holding was split between', () => {
    expect(
      goalsNowReadingHoldings(
        [
          { goalId: 'ike', share: 60 },
          { goalId: 'wakacje', share: 40 },
        ],
        [goal('ike', 'contributions'), goal('wakacje', 'contributions')]
      )
    ).toEqual(['ike', 'wakacje']);
  });

  /** A share of nought points at nothing, so it says nothing about where the money is. */
  it('ignores an assignment of nought per cent', () => {
    expect(
      goalsNowReadingHoldings([{ goalId: 'ike', share: 0 }], [goal('ike', 'contributions')])
    ).toEqual([]);
  });

  it('is empty when the holding is assigned to nothing', () => {
    expect(goalsNowReadingHoldings([], [goal('ike', 'contributions')])).toEqual([]);
  });

  /** A goal that is not there to be switched is not an error; it is simply not switched. */
  it('ignores an assignment naming a goal it was not given', () => {
    expect(goalsNowReadingHoldings([{ goalId: 'gone', share: 100 }], [])).toEqual([]);
  });
});
