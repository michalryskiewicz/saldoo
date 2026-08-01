import type { Currency } from '@/constant.ts';

type SummarisableTransaction = { amount: number; currency: Currency };

export type TransactionsSummary = {
  incoming: number;
  /** Signed, the way the column above it writes an outgoing payment. */
  outgoing: number;
  currency: Currency | undefined;
};

/**
 * What the visible payments add up to — as two figures, not one.
 *
 * A ledger holds money arriving and money leaving, so a single sum of it is a balance and not a
 * total. A balance is a fair number to want, but on its own it is also a quiet one: a month that
 * took twelve thousand in and paid eleven and a half out nets to five hundred, and the five
 * hundred is the least interesting thing that happened.
 */
export const summariseTransactions = (rows: SummarisableTransaction[]): TransactionsSummary => ({
  incoming: rows.reduce((total, row) => (row.amount > 0 ? total + row.amount : total), 0),
  outgoing: rows.reduce((total, row) => (row.amount < 0 ? total + row.amount : total), 0),
  currency: rows[0]?.currency,
});
