import { describe, expect, it } from 'vitest';
import { FREQUENCY } from '@/constant.ts';
import type { DBProfit } from '@/database/profits.ts';
import type { DBExpense } from '@/database/expenses.ts';
import { withResolvedPrice } from '../duty-price.service.ts';

const occurrence = (executionDate: Date, expense: object) =>
  ({ id: 'd1', executionDate, expense }) as unknown as {
    id: string;
    executionDate: Date;
    expense: DBExpense;
  };

describe('withResolvedPrice', () => {
  it('takes the amount and the currency from the cost behind the occurrence', () => {
    const rent = { id: 'e1', expense: 2500, currency: 'EUR' };

    const [priced] = withResolvedPrice([occurrence(new Date(2026, 3, 20), rent)], []);

    expect(priced.price).toBe(2500);
    expect(priced.currency).toBe('EUR');
  });

  /**
   * The reason this is a named function rather than a field read. A share of an income has no
   * amount on the record — `expense` is zero — so the screen showed 0,00 zł against a tax and the
   * period's total was short by the whole of it.
   */
  it('works out a share of an income for the month the occurrence falls in', () => {
    const invoice = {
      id: 'client-a',
      profit: 10000,
      frequency: FREQUENCY.YEARLY,
      execution: new Date(2026, 2, 10),
    } as DBProfit;
    const tax = {
      id: 'e2',
      expense: 0,
      currency: 'PLN',
      percentageOfIncome: { percent: 12, profitIds: ['client-a'], basePeriod: 'previousMonth' },
    };

    const priced = withResolvedPrice(
      [occurrence(new Date(2026, 3, 20), tax), occurrence(new Date(2026, 4, 20), tax)],
      [invoice]
    );

    // April is a share of March's invoice; May is a share of an April that had none.
    expect(priced[0].price).toBe(1200);
    expect(priced[1].price).toBe(0);
  });
});
