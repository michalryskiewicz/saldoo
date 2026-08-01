import { describe, expect, it } from 'vitest';
import { dutyRowTone, dutyTermState } from '../duty-term.service.ts';

const TODAY = new Date(2026, 6, 15);

describe('dutyTermState', () => {
  it('calls a date that has passed overdue', () => {
    expect(dutyTermState({ executionDate: new Date(2026, 6, 14), today: TODAY })).toBe('overdue');
  });

  it('calls today today, whatever time of day it is read at', () => {
    expect(dutyTermState({ executionDate: new Date(2026, 6, 15, 23, 30), today: TODAY })).toBe(
      'today'
    );
  });

  it('calls a date still ahead upcoming', () => {
    expect(dutyTermState({ executionDate: new Date(2026, 6, 16), today: TODAY })).toBe('upcoming');
  });

  /**
   * Colour on this screen says one thing: what still wants doing. A date that has passed on
   * something already paid is history, not urgency — left as "overdue" it would shout in red
   * about the one row that needs nothing.
   */
  it('calls a passed date settled once it has been paid', () => {
    expect(
      dutyTermState({ executionDate: new Date(2026, 6, 14), today: TODAY, resolved: true })
    ).toBe('settled');
  });

  it('calls a passed date settled once it has been skipped', () => {
    expect(
      dutyTermState({ executionDate: new Date(2026, 6, 14), today: TODAY, ignored: true })
    ).toBe('settled');
  });
});

describe('dutyRowTone', () => {
  it('leaves an occurrence that still wants paying at full strength', () => {
    expect(dutyRowTone({})).toBe('due');
  });

  it('quietens one that has been paid', () => {
    expect(dutyRowTone({ resolved: true })).toBe('settled');
  });

  it('marks one that will not happen as struck out rather than merely quiet', () => {
    expect(dutyRowTone({ ignored: true })).toBe('skipped');
  });

  it('treats a skipped occurrence as skipped even if it was once ticked', () => {
    expect(dutyRowTone({ resolved: true, ignored: true })).toBe('skipped');
  });
});
