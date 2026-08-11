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
   * Part-way through a period the bond is worth more than it was on day one, and this file used to
   * say otherwise.
   *
   * The old rule counted whole periods only and defended it as honesty. It is not: interest on
   * these accrues **daily**, and it is what somebody is actually paid on an early redemption, less
   * a fee — which is a separate figure and not a reason to print zero. Somebody six months into an
   * EDO read "0,00 zł earned" while the issuer's own calculator showed the interest that had built
   * up.
   */
  it('accrues day by day inside the period it is in', () => {
    // 184 of the 365 days between 10 March 2025 and 10 March 2026, of that year's 655.
    const halfWay = bondValueOn(bought(), new Date(2025, 8, 10));

    expect(halfWay.accruing).toBeCloseTo(330.19, 2);
    expect(halfWay.capitalised).toBe(0);
    expect(halfWay.accrued).toBeCloseTo(330.19, 2);
    expect(halfWay.value).toBeCloseTo(10330.19, 2);
  });

  /** Once a period closes, its interest joins the capital and the next one accrues on the larger base. */
  it('accrues on what the finished periods left behind', () => {
    const intoTheSecondYear = bondValueOn(bought(), new Date(2026, 8, 10));

    expect(intoTheSecondYear.capitalised).toBe(655);
    // 6.55% of 10 655, for 184 of 365 days.
    expect(intoTheSecondYear.accruing).toBeCloseTo(351.82, 2);
    expect(intoTheSecondYear.value).toBeCloseTo(11006.82, 2);
  });

  it('has accrued nothing on the day a period turns over', () => {
    const onTheAnniversary = bondValueOn(bought(), new Date(2026, 2, 10));

    expect(onTheAnniversary.accruing).toBe(0);
    expect(onTheAnniversary.capitalised).toBe(655);
  });

  /**
   * A paying bond does not grow — except for the days since it last paid, which are owed to
   * whoever holds it. What has already left for the person's account stays out of the holding's
   * value, or the same złoty is counted twice.
   */
  it('lets a paying bond carry what it has not paid out yet', () => {
    const coi = bondValueOn(bought({ interest: 'pays out' }), new Date(2027, 8, 10));

    expect(coi.paidOut).toBe(1310);
    // The same 184 days, over the 366 of a leap year rather than 365 — by the calendar, which is
    // the difference between this and dividing every period by an assumed 365.
    expect(coi.accruing).toBeCloseTo(329.29, 2);
    expect(coi.value).toBeCloseTo(10329.29, 2);
  });

  /** Asked about a day before it existed, a holding has earned nothing rather than owing anything. */
  it('has earned nothing before it was bought', () => {
    const before = bondValueOn(bought(), new Date(2024, 0, 1));

    expect(before.accrued).toBe(0);
    expect(before.value).toBe(10000);
  });
});
