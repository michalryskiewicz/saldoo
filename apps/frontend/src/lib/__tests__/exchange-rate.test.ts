import type { ListExchangeRatesResponseDTO } from '@/store/exchange-rates.api';
import { describe, expect, it } from 'vitest';
import { convertMoney } from '../exchange-rate';

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
