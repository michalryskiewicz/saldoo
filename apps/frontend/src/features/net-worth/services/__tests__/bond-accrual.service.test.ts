import { describe, expect, it } from 'vitest';
import type { DBBondHolding } from '@/database/bonds.ts';
import { bondValueOn, periodsElapsed } from '../bond-accrual.service.ts';

const bought = (fields: Partial<DBBondHolding> = {}): DBBondHolding =>
  ({
    id: 'b1',
    description: 'EDO0335',
    quantity: 100,
    nominal: 100,
    boughtOn: new Date(2025, 2, 10),
    ratePercent: 6.55,
    interest: 'compounds',
    period: 'yearly',
    currency: 'PLN',
    ...fields,
  }) as DBBondHolding;

describe('periodsElapsed', () => {
  it('counts whole years for a yearly bond', () => {
    expect(periodsElapsed(bought(), new Date(2028, 2, 9))).toBe(2);
    expect(periodsElapsed(bought(), new Date(2028, 2, 10))).toBe(3);
  });

  it('counts whole months for one that pays monthly', () => {
    expect(periodsElapsed(bought({ period: 'monthly' }), new Date(2025, 8, 10))).toBe(6);
  });

  it('is nothing at all on the day it was bought', () => {
    expect(periodsElapsed(bought(), new Date(2025, 2, 10))).toBe(0);
  });
});

describe('bondValueOn', () => {
  /**
   * A bond whose interest joins the capital — EDO and TOS behave this way. The holding itself
   * grows, so this is the figure that belongs in net worth.
   */
  it('grows the capital when the interest compounds', () => {
    const afterOneYear = bondValueOn(bought(), new Date(2026, 2, 10));

    expect(afterOneYear.capital).toBe(10000);
    expect(afterOneYear.accrued).toBe(655);
    expect(afterOneYear.value).toBe(10655);
  });

  it('compounds on the interest as well, not only on the capital', () => {
    // 10 000 at 6.55% for two years is 11 352.90. Simple interest would be 11 310 — the 42.90
    // between them is the whole reason to hold one of these for ten years rather than one.
    expect(bondValueOn(bought(), new Date(2027, 2, 10)).value).toBe(11352.9);
  });

  /**
   * A bond that pays its interest out — COI and ROR — does not grow. The money leaves for the
   * person's account, so the holding is still worth its nominal and the interest is income.
   * Adding both to net worth would count the same złoty twice.
   */
  it('leaves a paying bond at its nominal, and reports the interest separately', () => {
    const coi = bought({ interest: 'pays out' });
    const afterTwoYears = bondValueOn(coi, new Date(2027, 2, 10));

    expect(afterTwoYears.capital).toBe(10000);
    expect(afterTwoYears.value).toBe(10000);
    expect(afterTwoYears.paidOut).toBe(1310);
  });

  it('is worth exactly what was paid for it on the day it was bought', () => {
    const onDayOne = bondValueOn(bought(), new Date(2025, 2, 10));

    expect(onDayOne.value).toBe(10000);
    expect(onDayOne.accrued).toBe(0);
  });

  /**
   * Whole periods only, and deliberately. A rate is announced for a period and the interest is
   * credited at its end; spreading it across the days between would print a figure the bond does
   * not have yet, to two decimal places, about somebody's real money.
   */
  it('does not invent interest part-way through a period', () => {
    expect(bondValueOn(bought(), new Date(2026, 1, 28)).value).toBe(10000);
  });
});
