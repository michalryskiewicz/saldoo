import type { ListExchangeRatesResponseDTO } from '@/store/exchange-rates.api';
import { describe, expect, it } from 'vitest';
import { convertDataToDesiredCurrency, convertMoney } from '../exchange-rate';

describe('convertMoney', () => {
  const exchangeRates: ListExchangeRatesResponseDTO = {
    EUR: {
      '2025-10-19': 4.5,
      '2025-10-18': 4.4,
    },
    USD: {
      '2025-10-19': 4.0,
      '2025-10-18': 3.9,
    },
    PLN: {
      '2025-10-19': 1,
      '2025-10-18': 1,
    },
  };

  it('returns the same amount if fromCurrency and toCurrency are the same', () => {
    expect(
      convertMoney({
        amount: 100,
        fromCurrency: 'EUR',
        toCurrency: 'EUR',
        exchangeRates,
        effectiveDate: new Date('2025-10-19'),
      })
    ).toBe(100);
  });

  it('converts PLN to EUR using the correct rate', () => {
    expect(
      convertMoney({
        amount: 45,
        fromCurrency: 'PLN',
        toCurrency: 'EUR',
        exchangeRates,
        effectiveDate: new Date('2025-10-19'),
      })
    ).toBeCloseTo(10);
  });

  it('converts EUR to PLN using the correct rate', () => {
    expect(
      convertMoney({
        amount: 10,
        fromCurrency: 'EUR',
        toCurrency: 'PLN',
        exchangeRates,
        effectiveDate: new Date('2025-10-19'),
      })
    ).toBeCloseTo(45);
  });

  it('converts USD to EUR via PLN', () => {
    expect(
      convertMoney({
        amount: 10,
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        exchangeRates,
        effectiveDate: new Date('2025-10-19'),
      })
    ).toBeCloseTo((10 * 4.0) / 4.5);
  });

  it('returns the same amount if exchangeRates is undefined', () => {
    expect(
      convertMoney({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        exchangeRates: undefined,
        effectiveDate: new Date('2025-10-19'),
      })
    ).toBe(100);
  });

  it('returns the same amount if effectiveDate is undefined', () => {
    expect(
      convertMoney({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        exchangeRates,
        effectiveDate: undefined as never,
      })
    ).toBe(100);
  });

  it('returns the same amount if exchange rate for date is missing', () => {
    expect(
      convertMoney({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        exchangeRates,
        effectiveDate: new Date('2020-01-01'),
      })
    ).toBe(100);
  });

  describe('on a day no rate was published for', () => {
    // A rate is published on business days. The days it is not published on are ordinary days
    // on which money still moves: a bond is priced on a Sunday and a duty falls on a Saturday.
    const acrossAWeekend: ListExchangeRatesResponseDTO = {
      EUR: { '2026-08-07': 4.5, '2026-08-08': null, '2026-08-09': null },
      USD: { '2026-08-07': 4.0, '2026-08-08': null, '2026-08-09': null },
      PLN: { '2026-08-07': 1, '2026-08-08': null, '2026-08-09': null },
    };

    it('reads the last rate published before it', () => {
      expect(
        convertMoney({
          amount: 45,
          fromCurrency: 'PLN',
          toCurrency: 'EUR',
          exchangeRates: acrossAWeekend,
          effectiveDate: new Date('2026-08-09'),
        })
      ).toBeCloseTo(10);
    });

    it('reads the latest published rate for a day still to come', () => {
      // A duty falls next month and a projection reaches years out. Nobody holds a rate for
      // either, and the latest one published is the only rate anybody has.
      expect(
        convertMoney({
          amount: 45,
          fromCurrency: 'PLN',
          toCurrency: 'EUR',
          exchangeRates: acrossAWeekend,
          effectiveDate: new Date('2026-12-15'),
        })
      ).toBeCloseTo(10);
    });
  });

  it('handles string effectiveDate', () => {
    expect(
      convertMoney({
        amount: 10,
        fromCurrency: 'EUR',
        toCurrency: 'PLN',
        exchangeRates,
        effectiveDate: '2025-10-19' as never,
      })
    ).toBeCloseTo(45);
  });
});

describe('convertDataToDesiredCurrency', () => {
  const rates: ListExchangeRatesResponseDTO = {
    EUR: { '2025-10-19': 4.5 },
    USD: { '2025-10-19': 4.0 },
    PLN: { '2025-10-19': 1 },
  };

  const rows = [
    { id: 'e1', expense: 100, currency: 'PLN' },
    { id: 'e2', expense: 20, currency: 'EUR' },
  ];

  it('keeps the records when there are no rates to convert with', () => {
    // Rates come from a public endpoint that caches NBP data and holds nothing of the
    // user's. Returning an empty list when it cannot be reached made every expense
    // disappear from the screen while offline — in an app whose whole premise is that
    // the local database is the truth.
    expect(
      convertDataToDesiredCurrency({
        data: rows,
        exchangeRates: undefined,
        desiredCurrency: 'PLN',
        amountKey: 'expense',
      })
    ).toEqual(rows);
  });

  it('reports every record in the desired currency once rates are available', () => {
    const converted = convertDataToDesiredCurrency({
      data: rows,
      exchangeRates: rates,
      desiredCurrency: 'PLN',
      amountKey: 'expense',
    });

    expect(converted).toHaveLength(2);
    expect(converted.map((row) => row.currency)).toEqual(['PLN', 'PLN']);
  });

  it('leaves a record in its own currency when there is no rate to convert it at', () => {
    // The figure and the sign over it have to be the same money. Stamping the desired currency on
    // an amount that was never converted is the one outcome worse than not converting: a złoty
    // figure reading as euro is wrong by a factor of four and says nothing about being wrong.
    const beforeAnyRateWasPublished = [{ id: 'e1', expense: 100, currency: 'PLN', on: new Date('2019-01-01') }];

    expect(
      convertDataToDesiredCurrency({
        data: beforeAnyRateWasPublished,
        exchangeRates: rates,
        desiredCurrency: 'EUR',
        amountKey: 'expense',
        dateKey: 'on',
      })
    ).toEqual(beforeAnyRateWasPublished);
  });
});
