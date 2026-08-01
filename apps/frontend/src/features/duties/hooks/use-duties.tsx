import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useEffect } from 'react';
import { addDBDutiesForDateRange, type DBDuty } from '@/database/duty.ts';
import type { DBExpense } from '@/database/expenses';

type UseDutiesArgs = {
  from: Date;
  to: Date;
};

export const useDuties = ({ from, to }: UseDutiesArgs) => {
  const fromTime = from.getTime();
  const toTime = to.getTime();

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
    const [duties, expenses]: [DBDuty[], DBExpense[]] = await Promise.all([
      db.duties.toArray(),
      db.expenses.toArray(),
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

    return dutiesInSelectedRange
      .map((duty) => ({
        ...duty,
        expense: duty.expenseId ? (expenseMap.get(duty.expenseId) ?? null) : null,
      }))
      .filter((d) => d.expense);
  }, [fromTime, toTime]);

  return { duties: mergedDuties ?? [] };
};
