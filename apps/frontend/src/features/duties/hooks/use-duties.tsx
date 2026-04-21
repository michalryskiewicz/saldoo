import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useEffect } from 'react';
import { endOfMonth, startOfMonth } from 'date-fns';
import { addDBDutiesForDateRange, type DBDuty } from '@/database/duty.ts';
import type { DBExpense } from '@/database/expenses';

export const useDuties = () => {
  // ==========================================================================
  // Side Effect
  // ==========================================================================
  useEffect(() => {
    (async () => {
      const today = Date.now();

      const startDate = startOfMonth(today);
      const endDate = endOfMonth(today);

      await addDBDutiesForDateRange(
        { startDate, endDate },
        { regenFrom: startDate, keepResolved: true }
      );
    })();
  }, []);

  // ==========================================================================
  // Live Query
  // ==========================================================================
  const mergedDuties = useLiveQuery(async () => {
    const today = Date.now();

    const startDate = startOfMonth(today);
    const endDate = endOfMonth(today);

    const [duties, expenses]: [DBDuty[], DBExpense[]] = await Promise.all([
      db.duties.toArray(),
      db.expenses.toArray(),
    ]);

    const dutiesInSelectedMonth = duties.filter((duty) => {
      if (!duty.executionDate) return false;
      const execDate = new Date(duty.executionDate).getTime();
      return execDate >= startDate.getTime() && execDate <= endDate.getTime();
    });

    if (!duties?.length || !dutiesInSelectedMonth?.length) return [];

    const expenseMap = new Map<string, DBExpense>();
    for (const exp of expenses) {
      expenseMap.set(exp.id, exp);
    }

    return dutiesInSelectedMonth
      .map((duty) => ({
        ...duty,
        expense: duty.expenseId ? (expenseMap.get(duty.expenseId) ?? null) : null,
      }))
      .filter((d) => d.expense);
  }, []);

  return { duties: mergedDuties ?? [] };
};
