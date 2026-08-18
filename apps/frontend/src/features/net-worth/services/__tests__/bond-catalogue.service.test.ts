import { describe, expect, it } from 'vitest';
import {
  catalogueMonths,
  choiceFromCode,
  draftFromCatalogue,
  rateFor,
  recentMonths,
  seriesCodeFor,
  seriesOfferedIn,
  BOND_SERIES,
} from '../bond-catalogue.service.ts';

describe('seriesCodeFor', () => {
  /**
   * The whole August 2026 offer, which is the strongest oracle available for this: the codes are
   * published, so the derivation either reproduces all eight or it is wrong. A retail series is
   * named for the month it is **redeemed**, not the month it is sold — a 10-year bought in August
   * 2026 is EDO0836, and getting that backwards would name every holding after a year it has
   * nothing to do with.
   */
  it.each([
    ['ROR', 'ROR0827'],
    ['DOR', 'DOR0828'],
    ['TOS', 'TOS0829'],
    ['COI', 'COI0830'],
    ['ROS', 'ROS0832'],
    ['EDO', 'EDO0836'],
    ['ROD', 'ROD0838'],
  ] as const)('names a %s bought in August 2026 %s', (code, expected) => {
    expect(seriesCodeFor(code, '2026-08')).toBe(expected);
  });

  it('rolls the year over when the tenor crosses December', () => {
    expect(seriesCodeFor('ROR', '2026-11')).toBe('ROR1127');
    expect(seriesCodeFor('DOR', '2025-12')).toBe('DOR1227');
  });
});

describe('seriesOfferedIn', () => {
  it('offers what the catalogue has a rate for that month', () => {
    expect(seriesOfferedIn('2026-08').map((series) => series.code)).toEqual([
      'ROR',
      'DOR',
      'TOS',
      'COI',
      'ROS',
      'EDO',
      'ROD',
    ]);
  });

  /**
   * What was actually on sale, which is not the same list every month. ROR and DOR arrived in June
   * 2022 and TOS in August 2022, so somebody entering a purchase from 2019 is offered the four that
   * existed and is not invited to hold something that did not.
   */
  it('offers only the series that existed that month', () => {
    expect(seriesOfferedIn('2019-03').map((series) => series.code)).toEqual([
      'COI',
      'ROS',
      'EDO',
      'ROD',
    ]);
  });

  /**
   * Nothing at all before the catalogue starts, rather than the oldest rate stretched backwards.
   */
  it('offers nothing for a month older than anything recorded', () => {
    expect(seriesOfferedIn('2010-01')).toEqual([]);
  });

  /**
   * And nothing past the last offer anybody has read — the case that comes round every month. The
   * Ministry announces one month at a time, so carrying August's rate into September would be the
   * app inventing the very number it exists to look up.
   */
  it('offers nothing for a month past the last offer it has read', () => {
    expect(seriesOfferedIn('2026-09')).toEqual([]);
  });
});

describe('rateFor', () => {
  it('gives the first-period rate the Ministry announced that month', () => {
    expect(rateFor('EDO', '2026-08')).toBe(5.35);
    expect(rateFor('ROR', '2026-08')).toBe(4);
    expect(rateFor('EDO', '2024-11')).toBe(6.55);
  });

  it('holds a rate steady across the months it did not move', () => {
    // 6.55% ran from September 2024 to April 2025 without a change; every month in between is the
    // same answer, and the range says so once rather than eight times.
    expect(rateFor('EDO', '2024-09')).toBe(6.55);
    expect(rateFor('EDO', '2025-01')).toBe(6.55);
    expect(rateFor('EDO', '2025-05')).toBe(6.35);
  });

  it('answers for the months in between, which is the whole point', () => {
    expect(rateFor('EDO', '2026-06')).toBe(5.35);
    expect(rateFor('EDO', '2026-05')).toBe(5.35);
    expect(rateFor('COI', '2026-06')).toBe(4.75);
  });

  it('gives nothing outside the series own life, or past the last offer read', () => {
    // ROR did not exist in 2019, and no rate is stretched back to pretend it did.
    expect(rateFor('ROR', '2019-03')).toBeUndefined();
    expect(rateFor('EDO', '2010-01')).toBeUndefined();
    expect(rateFor('EDO', '2026-09')).toBeUndefined();
  });
});

describe('the series themselves', () => {
  /**
   * The two facts the arithmetic actually runs on. A series filed under the wrong one does not
   * fail anywhere — it quietly grows a holding that should have been paying out, or the reverse.
   */
  it('knows how each series pays', () => {
    const paying = BOND_SERIES.filter((series) => series.interest === 'pays out').map((s) => s.code);

    expect(paying).toEqual(['ROR', 'DOR', 'COI']);
  });

  it('knows how often', () => {
    const monthly = BOND_SERIES.filter((series) => series.period === 'monthly').map((s) => s.code);

    expect(monthly).toEqual(['ROR', 'DOR']);
  });
});

describe('draftFromCatalogue', () => {
  it('fills everything a holding needs from a month, a series and a count', () => {
    expect(
      draftFromCatalogue({ code: 'EDO', month: '2026-08', quantity: 100, today: new Date(2036, 0, 1) })
    ).toEqual({
      description: 'EDO0836',
      quantity: 100,
      nominal: 100,
      // The end of the month, deliberately: see the service.
      boughtOn: new Date(2026, 7, 31),
      ratePercent: 5.35,
      interest: 'compounds',
      period: 'yearly',
      currency: 'PLN',
    });
  });

  /**
   * Bought at the end of the month rather than at its start. Whichever day inside the month it
   * really was, this never credits an interest period before it is due — the same conservatism
   * `bondValueOn` applies to a period part-way through, and the reason a month is enough to ask for.
   */
  it('dates the purchase at the end of the month it was bought in', () => {
    expect(draftFromCatalogue({ code: 'EDO', month: '2025-04', quantity: 1 })?.boughtOn).toEqual(
      new Date(2025, 3, 30)
    );
  });

  /**
   * Except in the month we are in, which has not ended. A holding dated at the end of it would be
   * one the person does not hold yet — bought, on the app's telling, three weeks from now.
   */
  it('never dates a purchase in the future', () => {
    const draft = draftFromCatalogue({
      code: 'EDO',
      month: '2026-08',
      quantity: 1,
      today: new Date(2026, 7, 7),
    });

    expect(draft?.boughtOn).toEqual(new Date(2026, 7, 7));
  });

  it('is nothing at all when the catalogue has no rate to fill in', () => {
    expect(draftFromCatalogue({ code: 'EDO', month: '2010-01', quantity: 10 })).toBeUndefined();
    expect(draftFromCatalogue({ code: 'ROR', month: '2019-03', quantity: 10 })).toBeUndefined();
  });

  /**
   * A rate the person supplied wins, and is the only way a month the catalogue has never read can
   * be entered at all. The structure still comes from the catalogue: which series compounds and
   * how often has not changed in years, and it is not what anybody has to look up.
   */
  it('takes a rate it was given for a month it does not know', () => {
    expect(draftFromCatalogue({ code: 'EDO', month: '2010-01', quantity: 10, ratePercent: 3.2 })).toEqual({
      description: 'EDO0120',
      quantity: 10,
      nominal: 100,
      boughtOn: new Date(2010, 0, 31),
      ratePercent: 3.2,
      interest: 'compounds',
      period: 'yearly',
      currency: 'PLN',
    });
  });
});

describe('choiceFromCode', () => {
  /**
   * Reading a holding back into the two things it was chosen by, so opening one for editing shows
   * the month and the series rather than a form full of arithmetic. The name carries both: the
   * series, and the month it is redeemed — from which the month it was sold is its tenor back.
   */
  it('reads the month and series back out of a published name', () => {
    expect(choiceFromCode('EDO0836')).toEqual({ code: 'EDO', month: '2026-08' });
    expect(choiceFromCode('ROR0827')).toEqual({ code: 'ROR', month: '2026-08' });
    expect(choiceFromCode('DOR1227')).toEqual({ code: 'DOR', month: '2025-12' });
  });

  it('gives nothing for a name somebody wrote themselves', () => {
    expect(choiceFromCode('Obligacje taty')).toBeUndefined();
    expect(choiceFromCode('XYZ0836')).toBeUndefined();
  });
});

describe('recentMonths', () => {
  it('runs back from the month given, newest first', () => {
    expect(recentMonths(3, new Date(2026, 7, 15))).toEqual(['2026-08', '2026-07', '2026-06']);
  });
});

describe('catalogueMonths', () => {
  /**
   * Every month the picker can offer, with no holes in the middle: a month the person can choose
   * and then be told nothing about is exactly the dead end this catalogue was widened to remove.
   */
  it('runs unbroken from the oldest recorded month to the newest', () => {
    const months = catalogueMonths();

    expect(months.at(0)).toBe('2016-01');
    expect(months.at(-1)).toBe('2026-08');
    expect(months).toHaveLength(128);
    expect(new Set(months).size).toBe(months.length);
  });

  it('can price something in every month it offers', () => {
    const dead = catalogueMonths().filter((month) => seriesOfferedIn(month).length === 0);

    expect(dead).toEqual([]);
  });
});
