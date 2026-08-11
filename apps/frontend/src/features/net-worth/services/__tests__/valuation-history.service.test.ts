import { describe, expect, it } from 'vitest';
import type { DBValuation } from '@/database/valuations.ts';
import { changeSincePrevious, isNewReading } from '../valuation-history.service.ts';

const said = (positionId: string, value: number, valuedOn: string): DBValuation => ({
  id: `${positionId}-${valuedOn}`,
  createdAt: new Date(valuedOn),
  positionId,
  value,
  currency: 'PLN',
  valuedOn: new Date(valuedOn),
});

describe('changeSincePrevious', () => {
  /**
   * What a holding has done since anybody last looked at it — the fact a single stored value cannot
   * express, and the one that turns a list of holdings into something you can read a decision from.
   */
  it('is the difference between the two most recent readings', () => {
    const history = [said('konto', 30000, '2026-05-01'), said('konto', 31500, '2026-08-01')];

    expect(changeSincePrevious('konto', history)).toEqual({
      positionId: 'konto',
      amount: 1500,
      currency: 'PLN',
      since: new Date('2026-05-01'),
      // The day of the *latest* reading, so a change shown in another currency can be converted at
      // one rate rather than at two. Two rates would move the figure by the rate's own drift and
      // report a holding as having grown when nothing about it did.
      on: new Date('2026-08-01'),
    });
  });

  it('reads the two most recent whatever order they arrive in', () => {
    // Two devices file their own history and the projector writes whatever reaches it first, so the
    // order of this list is not a fact about time.
    const history = [
      said('konto', 31500, '2026-08-01'),
      said('konto', 28000, '2026-01-01'),
      said('konto', 30000, '2026-05-01'),
    ];

    expect(changeSincePrevious('konto', history)?.amount).toBe(1500);
  });

  it('reports a fall as a fall', () => {
    const history = [said('konto', 30000, '2026-05-01'), said('konto', 25000, '2026-08-01')];

    expect(changeSincePrevious('konto', history)?.amount).toBe(-5000);
  });

  it('says nothing when a holding has only ever been valued once', () => {
    // Not zero: nought would read as "it has not moved", and this holding has no before to move from.
    expect(changeSincePrevious('konto', [said('konto', 30000, '2026-05-01')])).toBeUndefined();
  });

  it('says nothing about a holding with no history at all', () => {
    expect(changeSincePrevious('konto', [])).toBeUndefined();
  });

  it('ignores other holdings entirely', () => {
    const history = [
      said('konto', 30000, '2026-05-01'),
      said('akcje', 9000, '2026-06-01'),
      said('akcje', 12000, '2026-07-01'),
    ];

    expect(changeSincePrevious('konto', history)).toBeUndefined();
    expect(changeSincePrevious('akcje', history)?.amount).toBe(3000);
  });

  /**
   * Two readings for one day is what a correction looks like: somebody said 30 000, then said 31 000
   * about the same day. The later saying is the one that counts, and the day before it is what it
   * should be compared against — not the figure it replaced.
   */
  it('takes the latest saying about a day, not the one it corrects', () => {
    const history = [
      said('konto', 28000, '2026-05-01'),
      { ...said('konto', 30000, '2026-08-01'), createdAt: new Date('2026-08-01T09:00:00Z') },
      { ...said('konto', 31000, '2026-08-01'), createdAt: new Date('2026-08-01T18:00:00Z') },
    ];

    expect(changeSincePrevious('konto', history)?.amount).toBe(3000);
  });

  /** Rounded the way money is, or two readings of 0.005 apart report a change of 1e-15. */
  it('reports the difference as money rather than as floating point', () => {
    const history = [said('konto', 1000.1, '2026-05-01'), said('konto', 1000.2, '2026-08-01')];

    expect(changeSincePrevious('konto', history)?.amount).toBe(0.1);
  });
});

describe('isNewReading', () => {
  const stored = { value: 30000, valuedOn: new Date('2026-05-01') };

  /**
   * Saving a holding is not always saying something new about its worth — a rename is a save too.
   * Filing a valuation for every save would fill the history with rows that say nothing and send
   * every one of them to the other device.
   */
  it('is a new reading when the worth changed', () => {
    expect(isNewReading({ value: 31500, valuedOn: new Date('2026-05-01') }, stored)).toBe(true);
  });

  it('is a new reading when the day changed', () => {
    // The same figure, said about a later day, is somebody confirming it still holds.
    expect(isNewReading({ value: 30000, valuedOn: new Date('2026-08-01') }, stored)).toBe(true);
  });

  it('is not a new reading when neither changed', () => {
    expect(isNewReading({ value: 30000, valuedOn: new Date('2026-05-01') }, stored)).toBe(false);
  });

  it('is a new reading when there is nothing stored yet', () => {
    expect(isNewReading({ value: 30000, valuedOn: new Date('2026-05-01') }, undefined)).toBe(true);
  });
});
