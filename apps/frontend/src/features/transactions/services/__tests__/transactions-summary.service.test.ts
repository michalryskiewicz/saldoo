import { describe, expect, it } from 'vitest';
import type { Currency } from '@/constant.ts';
import { summariseTransactions } from '../transactions-summary.service.ts';

const paid = (amount: number, currency: Currency = 'PLN') => ({ amount, currency });

describe('summariseTransactions', () => {
  it('keeps what arrived apart from what left', () => {
    // Netting them would report a balance near zero for a month that moved seventeen thousand
    // through the account, which is the fact worth seeing.
    const summary = summariseTransactions([paid(12500), paid(-2500), paid(-213.47)]);

    expect(summary.incoming).toBe(12500);
    expect(summary.outgoing).toBe(-2713.47);
  });

  it('reports what left as the column writes it, sign and all', () => {
    expect(summariseTransactions([paid(-65)]).outgoing).toBe(-65);
  });

  it('is two zeroes over nothing at all', () => {
    expect(summariseTransactions([])).toEqual({ incoming: 0, outgoing: 0, currency: undefined });
  });

  it('files a zero as neither arriving nor leaving', () => {
    expect(summariseTransactions([paid(0)])).toEqual({
      incoming: 0,
      outgoing: 0,
      currency: 'PLN',
    });
  });

  it('takes its currency from the rows, since money has to be written in one', () => {
    expect(summariseTransactions([paid(-65, 'EUR')]).currency).toBe('EUR');
  });
});
