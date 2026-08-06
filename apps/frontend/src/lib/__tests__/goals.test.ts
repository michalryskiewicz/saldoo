import { describe, expect, it } from 'vitest';
import {
  completionDate,
  emergencyFundTarget,
  lifetimeOfSeries,
  requiredMonthlyContribution,
} from '../goals.ts';
import type { DBExpense } from '@/database/expenses.ts';
import { convertDataToDesiredCurrency } from '../exchange-rate.ts';
import type { ListExchangeRatesResponseDTO } from '@/store/exchange-rates.api';

const JULY_2027 = new Date(2027, 6, 1);
const NOVEMBER_2026 = new Date(2026, 10, 1);

describe('requiredMonthlyContribution', () => {
  it('spreads what is left over the months left', () => {
    // 8 000 by July, asked in November, is eight calendar months away.
    expect(
      requiredMonthlyContribution({ target: 8000, saved: 0, deadline: JULY_2027 }, NOVEMBER_2026)
    ).toBe(1000);
  });

  it('spreads what is left, not what it started at', () => {
    expect(
      requiredMonthlyContribution({ target: 8000, saved: 6000, deadline: JULY_2027 }, NOVEMBER_2026)
    ).toBe(250);
  });

  /**
   * A deadline gone by does not make the answer infinite, and it must not make it zero either.
   * What is left is owed, and it is owed now.
   */
  it('asks for the whole remainder when the day has already passed', () => {
    expect(
      requiredMonthlyContribution(
        { target: 8000, saved: 5000, deadline: new Date(2026, 1, 1) },
        NOVEMBER_2026
      )
    ).toBe(3000);
  });

  it('asks for nothing once the target is reached', () => {
    expect(
      requiredMonthlyContribution({ target: 8000, saved: 8000, deadline: JULY_2027 }, NOVEMBER_2026)
    ).toBe(0);
  });
});

/**
 * The relationship the other way round, which is the one the emergency fund needs: it has no
 * deadline, so it is given a pace and told the date that follows.
 */
describe('completionDate', () => {
  it('says which month the pace gets there in', () => {
    // 8 000 to go at 1 000 a month is eight months, so July from November.
    expect(completionDate({ target: 10000, saved: 2000, monthlyPace: 1000 }, NOVEMBER_2026)).toEqual(
      JULY_2027
    );
  });

  it('rounds up, because a part-month still has to be lived through', () => {
    expect(completionDate({ target: 1000, saved: 0, monthlyPace: 300 }, NOVEMBER_2026)).toEqual(
      new Date(2027, 2, 1)
    );
  });

  it('has no date to give when nothing is being put aside', () => {
    expect(
      completionDate({ target: 10000, saved: 2000, monthlyPace: 0 }, NOVEMBER_2026)
    ).toBeUndefined();
  });

  it('is today once there is nothing left to save', () => {
    expect(
      completionDate({ target: 10000, saved: 10000, monthlyPace: 500 }, NOVEMBER_2026)
    ).toEqual(NOVEMBER_2026);
  });
});

describe('emergencyFundTarget', () => {
  const rent = [
    {
      execution: '2026-11-10',
      expense: 1000,
      frequency: 'MONTHLY',
      severity: 'HIGH',
    },
  ] as unknown as DBExpense[];

  /**
   * The level is the decision and the amount is the result (#93 pt. 7). Three months of a monthly
   * 1 000, with the 10% the fund carries for what nobody foresaw.
   */
  it('works the amount out from the level', () => {
    expect(emergencyFundTarget(3, 10, rent)).toBe(3300);
    expect(emergencyFundTarget(6, 10, rent)).toBe(6600);
    expect(emergencyFundTarget(12, 10, rent)).toBe(13200);
  });

  it('follows the costs it is computed from, with nothing having left the account', () => {
    const dearer = [{ ...rent[0], expense: 1200 }] as unknown as DBExpense[];

    expect(emergencyFundTarget(3, 10, dearer)).toBeGreaterThan(emergencyFundTarget(3, 10, rent));
  });
});

describe('lifetimeOfSeries', () => {
  /**
   * The figure that makes a yearly goal worth having, and the reason it is never stored: it is the
   * closed windows plus what is in the pot now, so it cannot disagree with either of them.
   */
  it('adds the years that closed to the one still open', () => {
    const closed = [{ contributed: 26000 }, { contributed: 24000 }];

    expect(lifetimeOfSeries(closed, 8000)).toBe(58000);
  });

  it('is just the pot before any year has closed', () => {
    expect(lifetimeOfSeries([], 8000)).toBe(8000);
  });
});

/**
 * The reason no exchange rate is stored on a contribution, asserted rather than assumed.
 *
 * #93 pt. 4 says the figure must never fall on its own. A bar that retreats because the euro did
 * is the clearest possible way to break that — so a contribution is valued at the rate of the day
 * it was made, forever, and `convertDataToDesiredCurrency` already knows how to do that from the
 * record's own date.
 */
describe('a contribution keeps the rate of its own day', () => {
  const exchangeRates = {
    EUR: { '2025-10-19': 4.5, '2025-10-18': 4.0 },
    USD: { '2025-10-19': 4.0, '2025-10-18': 4.0 },
    PLN: { '2025-10-19': 1, '2025-10-18': 1 },
  } as unknown as ListExchangeRatesResponseDTO;

  it('values what went in on the 18th at the 18th, not at today', () => {
    const contributions = [
      { amount: 100, currency: 'EUR', contributedAt: new Date('2025-10-18') },
      { amount: 100, currency: 'EUR', contributedAt: new Date('2025-10-19') },
    ];

    const inZloty = convertDataToDesiredCurrency({
      data: contributions,
      exchangeRates,
      desiredCurrency: 'PLN',
      amountKey: 'amount',
      dateKey: 'contributedAt',
    });

    // The same 100 euro, put aside a day apart, is two different amounts of zloty — and neither of
    // them changes again tomorrow.
    expect(inZloty[0].amount).toBe(400);
    expect(inZloty[1].amount).toBe(450);
  });
});
