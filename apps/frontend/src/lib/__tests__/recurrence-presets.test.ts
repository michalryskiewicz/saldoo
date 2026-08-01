import { describe, expect, it } from 'vitest';
import { FREQUENCY } from '@/constant.ts';
import { CADENCE, cadenceOf, presetFor, withResolvedCadence } from '../recurrence-presets.ts';

describe('cadenceOf', () => {
  it('turns a named cadence into the unit and the step it stands for', () => {
    expect(cadenceOf(CADENCE.QUARTERLY)).toEqual({
      frequency: FREQUENCY.MONTHLY,
      interval: 3,
    });
    expect(cadenceOf(CADENCE.FOUR_WEEKLY)).toEqual({
      frequency: FREQUENCY.WEEKLY,
      interval: 4,
    });
  });

  it('has nothing to say about a cadence the person is spelling out themselves', () => {
    expect(cadenceOf(CADENCE.CUSTOM)).toBeUndefined();
  });
});

describe('presetFor', () => {
  it('finds the name of a cadence that has one, so editing opens on the answer given', () => {
    expect(presetFor({ frequency: FREQUENCY.MONTHLY, interval: 6 })).toBe(CADENCE.HALF_YEARLY);
    expect(presetFor({ frequency: FREQUENCY.WEEKLY, interval: 2 })).toBe(CADENCE.BIWEEKLY);
  });

  it('reads a missing interval as every one, which is what it has always meant', () => {
    expect(presetFor({ frequency: FREQUENCY.MONTHLY })).toBe(CADENCE.MONTHLY);
  });

  it('falls back to spelling it out when no name fits', () => {
    expect(presetFor({ frequency: FREQUENCY.WEEKLY, interval: 5 })).toBe(CADENCE.CUSTOM);
  });

  it('has no answer for something that does not recur at all', () => {
    expect(presetFor({})).toBeUndefined();
  });
});

describe('withResolvedCadence', () => {
  it('turns the answer given into the unit and step the record stores', () => {
    expect(
      withResolvedCadence({ description: 'Ubezpieczenie', cadence: CADENCE.QUARTERLY })
    ).toEqual({
      description: 'Ubezpieczenie',
      frequency: FREQUENCY.MONTHLY,
      interval: 3,
    });
  });

  it('keeps what the person spelled out themselves', () => {
    expect(
      withResolvedCadence({ cadence: CADENCE.CUSTOM, frequency: FREQUENCY.WEEKLY, interval: 5 })
    ).toEqual({ frequency: FREQUENCY.WEEKLY, interval: 5 });
  });

  it('does not carry the answer itself into the record', () => {
    // `cadence` is how the question was asked, not something the app knows about a cost. Left in,
    // it would travel to the other device and outlive the form that invented it.
    expect(withResolvedCadence({ cadence: CADENCE.MONTHLY })).not.toHaveProperty('cadence');
  });
});
