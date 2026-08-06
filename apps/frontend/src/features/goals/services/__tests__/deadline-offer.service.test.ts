import { describe, expect, it } from 'vitest';
import type { DBContribution } from '@/database/contributions.ts';
import type { DBGoal } from '@/database/goals.ts';
import { deadlineOffer } from '../deadline-offer.service.ts';

const TODAY = new Date(2026, 6, 15);

const goal = (fields: Partial<DBGoal> = {}): DBGoal =>
  ({
    id: 'g1',
    createdAt: new Date(2026, 0, 10),
    description: 'Remont',
    target: 12000,
    deadline: new Date(2026, 9, 31),
    ...fields,
  }) as DBGoal;

const gave = (month: number, amount: number, transactionId: string | null = 'tx'): DBContribution =>
  ({
    id: `c${month}`,
    goalId: 'g1',
    amount,
    contributedAt: new Date(2026, month, 12),
    transactionId,
  }) as DBContribution;

describe('deadlineOffer', () => {
  /**
   * The answer to a bad month, and the reason the number is never raised instead: the only failure
   * in this system is abandoning a goal, not being late with one (#93 pt. 11).
   */
  it('offers a later date when the goal has outgrown what the person manages', () => {
    // 600, 700, 640 a month confirmed — a median of 640 against 4 000 a month still required.
    const offer = deadlineOffer(
      goal(),
      [gave(3, 600), gave(4, 700), gave(5, 640)],
      TODAY
    );

    expect(offer?.pace).toBe(640);
    // 12 000 less 1 940 already in, at 640 a month, is sixteen more months.
    expect(offer?.deadline).toEqual(new Date(2027, 10, 15));
  });

  it('offers nothing while the person is keeping up', () => {
    const keepingUp = goal({ target: 3000, deadline: new Date(2027, 6, 31) });

    expect(deadlineOffer(keepingUp, [gave(3, 600), gave(4, 700), gave(5, 640)], TODAY)).toBeUndefined();
  });

  /**
   * A declaration a statement has not backed is not evidence of what somebody can manage — that is
   * the whole reason the median waits for confirmation.
   */
  it('ignores what no statement has confirmed', () => {
    const unconfirmed = deadlineOffer(
      goal(),
      [gave(3, 600), gave(4, 5000, null), gave(5, 640)],
      TODAY
    );

    expect(unconfirmed?.pace).toBe(620);
  });

  it('offers nothing when there is no history to judge by', () => {
    expect(deadlineOffer(goal(), [], TODAY)).toBeUndefined();
  });

  it('offers nothing to a goal with no deadline to move', () => {
    expect(deadlineOffer(goal({ deadline: undefined }), [gave(3, 600)], TODAY)).toBeUndefined();
  });
});
