import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useEffect } from 'react';
import { addDBDutiesForDateRange, type DBDuty } from '@/database/duty.ts';
import type { DBExpense } from '@/database/expenses';
import { useSettings } from '@/features/settings/use-settings.ts';
import { useListExchangeRatesQuery } from '@/store/exchange-rates.api.ts';
import { convertDataToDesiredCurrency } from '@/lib/exchange-rate.ts';
import { withResolvedPrice } from '@/features/duties/services/duty-price.service.ts';
import { toISODate } from '@/lib/dates.ts';

type UseDutiesArgs = {
  from: Date;
  to: Date;
};

export const useDuties = ({ from, to }: UseDutiesArgs) => {
  const fromTime = from.getTime();
  const toTime = to.getTime();

  const { settings } = useSettings();
  const { data: exchangeRates } = useListExchangeRatesQuery({
    fromDate: toISODate(from),
    toDate: toISODate(to),
  });

  // ==========================================================================
  // Side Effect — generate duties for the selected range
  // ==========================================================================
  useEffect(() => {
    (async () => {
      await addDBDutiesForDateRange(
        { startDate: from, endDate: to },
        { regenFrom: from }
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTime, toTime]);

  // ==========================================================================
  // Live Query
  // ==========================================================================
  const mergedDuties = useLiveQuery(async () => {
    const [duties, expenses, profits] = await Promise.all([
      db.duties.toArray() as Promise<DBDuty[]>,
      db.expenses.toArray() as Promise<DBExpense[]>,
      db.profits.toArray(),
    ]);

    const dutiesInSelectedRange = duties.filter((duty) => {
      if (!duty.executionDate) return false;
      const execDate = new Date(duty.executionDate).getTime();
      return execDate >= fromTime && execDate <= toTime;
    });

    if (!duties?.length || !dutiesInSelectedRange?.length) return [];

    const expenseMap = new Map<string, DBExpense>();
    for (const exp of expenses) {
      expenseMap.set(exp.id, exp);
    }

    const withExpense = dutiesInSelectedRange
      .map((duty) => ({
        ...duty,
        expense: duty.expenseId ? (expenseMap.get(duty.expenseId) ?? null) : null,
      }))
      .filter((duty): duty is typeof duty & { expense: DBExpense } => Boolean(duty.expense));

    return withResolvedPrice(withExpense, profits);
  }, [fromTime, toTime]);

  // Converted here rather than in the table, so the rows and the figure under them are the same
  // money. Left alone the screen showed each cost in whatever currency it was entered in and added
  // them anyway — the only screen of the three that did not convert.
  //
  // Unconverted rather than empty when there is nothing to convert with: the helper hands the rows
  // back untouched without rates, and asking it for a conversion into no currency at all would
  // empty the table while the settings load.
  const rows = mergedDuties ?? [];
  const duties = settings?.currency
    ? convertDataToDesiredCurrency({
        data: rows,
        exchangeRates,
        desiredCurrency: settings.currency,
        amountKey: 'price',
        dateKey: 'executionDate',
      })
    : rows;

  return { duties, currency: settings?.currency };
};
