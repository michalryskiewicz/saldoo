import { describe, expect, it } from 'vitest';
import type { Currency } from '@/constant.ts';
import type { ListExchangeRatesResponseDTO } from '@/store/exchange-rates.api.ts';
import { summariseTransactions, withPreferredCurrency } from '../transactions-summary.service.ts';

const paid = (amount: number, currency: Currency = 'PLN') => ({ amount, currency });

describe('withPreferredCurrency', () => {
  const rates: ListExchangeRatesResponseDTO = {
    EUR: { '2026-08-07': 4.5 },
    USD: { '2026-08-07': 4.0 },
    PLN: { '2026-08-07': 1 },
  };

  const paidOn = (amount: number, currency: Currency, transactionDate: string) => ({
    amount,
    currency,
    transactionDate: new Date(transactionDate),
  });

  it('puts a worth in one currency beside the money the bank wrote', () => {
    const [row] = withPreferredCurrency([paidOn(-45, 'PLN', '2026-08-07')], 'EUR', rates);

    // The row still reads as the statement reads it; only the figure beside it is euro.
    expect(row.amount).toBe(-45);
    expect(row.currency).toBe('PLN');
    expect(row.preferred).toEqual({ amount: -10, currency: 'EUR' });
  });

  it('leaves a payment without a worth when no rate reaches it', () => {
    const [row] = withPreferredCurrency([paidOn(-45, 'PLN', '2019-01-01')], 'EUR', rates);

    expect(row.preferred).toBeUndefined();
  });

  it('reads a payment already in the currency as its own worth', () => {
    const [row] = withPreferredCurrency([paidOn(-10, 'EUR', '2026-08-07')], 'EUR', rates);

    expect(row.preferred).toEqual({ amount: -10, currency: 'EUR' });
  });
});

describe('summariseTransactions', () => {
  it('keeps what arrived apart from what left', () => {
    // Netting them would report a balance near zero for a month that moved seventeen thousand
    // through the account, which is the fact worth seeing.
    const summary = summariseTransactions([paid(12500), paid(-2500), paid(-213.47)], 'PLN');

    expect(summary.incoming).toBe(12500);
    expect(summary.outgoing).toBe(-2713.47);
  });

  it('reports what left as the column writes it, sign and all', () => {
    expect(summariseTransactions([paid(-65)], 'PLN').outgoing).toBe(-65);
  });

  it('is two zeroes over nothing at all', () => {
    expect(summariseTransactions([], 'PLN')).toEqual({
      incoming: 0,
      outgoing: 0,
      currency: 'PLN',
      omitted: 0,
    });
  });

  it('files a zero as neither arriving nor leaving', () => {
    expect(summariseTransactions([paid(0)], 'PLN')).toEqual({
      incoming: 0,
      outgoing: 0,
      currency: 'PLN',
      omitted: 0,
    });
  });

  it('reports the currency it was asked to report', () => {
    expect(summariseTransactions([paid(-65, 'EUR')], 'EUR').currency).toBe('EUR');
  });

  it('adds up only the money written in the currency it reports', () => {
    // Left to itself the sum took every row and signed the result with whichever currency happened
    // to come first, so an account reading in euro with one złoty payment on it reported the złoty
    // at face value — four times the money, under a euro sign.
    expect(summariseTransactions([paid(20, 'EUR'), paid(1000, 'PLN')], 'EUR')).toEqual({
      incoming: 20,
      outgoing: 0,
      currency: 'EUR',
      omitted: 1,
    });
  });
});
