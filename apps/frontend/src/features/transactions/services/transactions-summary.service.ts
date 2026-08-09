import type { Currency } from '@/constant.ts';
import type { ListExchangeRatesResponseDTO } from '@/store/exchange-rates.api.ts';
import { rateBetween } from '@/lib/exchange-rate.ts';

type SummarisableTransaction = { amount: number; currency: Currency };

type DatedPayment = { amount: number; currency: Currency; transactionDate: Date | string };

/** A payment beside what it was worth in one currency, where a rate could say. */
export type WithPreferredCurrency<T> = T & {
  preferred?: { amount: number; currency: Currency };
};

/**
 * Every payment beside its worth in one currency, without rewriting any of them.
 *
 * A statement read back in another currency is no longer the statement: the bank wrote 45 zł and
 * that is what the row says, forever. What one currency is needed for is the figure underneath,
 * since a total in two currencies is not a total — so the converted amount rides alongside rather
 * than over the original.
 *
 * Converted at the rate of **the day it was paid**. A payment made in March was worth what it was
 * worth in March, and re-pricing it at today's rate would move a total that nothing happened to.
 *
 * Absent where no rate reaches the day — the summary counts those out rather than guessing at them.
 */
export const withPreferredCurrency = <T extends DatedPayment>(
  rows: T[],
  currency: Currency,
  exchangeRates: ListExchangeRatesResponseDTO | undefined
): WithPreferredCurrency<T>[] =>
  rows.map((row) => {
    const rate = rateBetween({
      fromCurrency: row.currency,
      toCurrency: currency,
      exchangeRates,
      effectiveDate: new Date(row.transactionDate),
    });

    return rate === undefined
      ? row
      : {
          ...row,
          preferred: { amount: Math.round(row.amount * rate * 100) / 100, currency },
        };
  });

export type TransactionsSummary = {
  incoming: number;
  /** Signed, the way the column above it writes an outgoing payment. */
  outgoing: number;
  currency: Currency;
  /**
   * How many visible payments the total leaves out, having no rate to bring them into its currency.
   *
   * Nought in the ordinary case. Above nought, the total is honest about being partial — which is
   * the only alternative to being wrong in silence.
   */
  omitted: number;
};

/**
 * What the visible payments add up to, in one stated currency — as two figures, not one.
 *
 * A ledger holds money arriving and money leaving, so a single sum of it is a balance and not a
 * total. A balance is a fair number to want, but on its own it is also a quiet one: a month that
 * took twelve thousand in and paid eleven and a half out nets to five hundred, and the five
 * hundred is the least interesting thing that happened.
 *
 * The currency is the caller's to state, and only rows already written in it are added up. Reading
 * it off the first row instead is what let a złoty payment into a euro total at its face figure —
 * four times the money, with euro written underneath. A row that could not be brought into the
 * currency is counted in `omitted`, never converted here: this adds money up, it does not price it.
 */
export const summariseTransactions = (
  rows: SummarisableTransaction[],
  currency: Currency
): TransactionsSummary => {
  const inCurrency = rows.filter((row) => row.currency === currency);

  return {
    incoming: inCurrency.reduce((total, row) => (row.amount > 0 ? total + row.amount : total), 0),
    outgoing: inCurrency.reduce((total, row) => (row.amount < 0 ? total + row.amount : total), 0),
    currency,
    omitted: rows.length - inCurrency.length,
  };
};
