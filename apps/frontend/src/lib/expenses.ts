import type { DBExpense } from '@/database/expenses';
import { MONTHS } from './dates';
import type { DBProfit } from '@/database/profits.ts';
import { isValid } from 'date-fns';
import type { DBTransaction } from '@/database/transactions.ts';
import type { DBDuty } from '@/database/duty.ts';
import type { Currency } from '@/constant.ts';
import type { DBTag } from '@/database/tags.ts';
import { costInMonth } from '@/lib/recurrence.ts';
import { groupProfitsByMonth } from '@/lib/profits.ts';

type SeverityTotals = { total: number; HIGH: number; MEDIUM: number; LOW: number };

export function groupExpensesByMonth(data: DBExpense[]) {
  const result: Record<number, SeverityTotals> = {};

  const ensureMonth = (month: number) => {
    if (!result[month]) result[month] = { total: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  };

  // An expense with no severity still counts towards the month's total; it simply
  // has no bucket to land in. Indexing by a null severity would invent one.
  const addToMonth = (month: number, severity: DBExpense['severity'], value: number) => {
    if (severity) result[month][severity] += value;
    result[month].total += value;
  };

  const year = new Date().getFullYear();

  data.forEach((item) => {
    if (!item.execution) return;

    for (let m = 0; m < 12; m++) {
      ensureMonth(m);
      addToMonth(m, item.severity, costInMonth(item, item.expense, { year, monthIndex: m }));
    }
  });

  return MONTHS.map((_, m) => ({
    month: m,
    total: Number(result[m]?.total?.toFixed(2)) || 0,
    high: Number(result[m]?.HIGH?.toFixed(2)) || 0,
    medium: Number(result[m]?.MEDIUM?.toFixed(2)) || 0,
    low: Number(result[m]?.LOW?.toFixed(2)) || 0,
  }));
}

export function groupExpensesAndProfitsByMonth(expenses: DBExpense[], profits: DBProfit[]) {
  const expenseResult: number[] = Array(12).fill(0);

  const year = new Date().getFullYear();

  expenses.forEach((item) => {
    if (item.execution && !isValid(new Date(item.execution))) return;

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      expenseResult[monthIndex] += costInMonth(item, item.expense, { year, monthIndex });
    }
  });

  // Profits, counted as often as they actually arrive. This loop used to add every profit to
  // all twelve months whatever its frequency, which reported a one-off yearly commission of
  // 3200 as 38 400 a year and drew the profit line flat across the overview.
  const profitsByMonth = groupProfitsByMonth(profits);

  // Return array with month index, totalExpense, and totalProfits
  return MONTHS.map((_, monthIndex) => ({
    month: monthIndex,
    totalProfits: profitsByMonth[monthIndex].total,
    totalExpense: Number(expenseResult[monthIndex].toFixed(2)),
  }));
}

export function groupExpensesByCategory(month: number, data: (DBExpense & { tag?: DBTag })[]) {
  const year = new Date().getFullYear();
  const tagTotals: Record<string, number> = {};

  data.forEach((item) => {
    if (!item.tag?.name) return;

    const total = costInMonth(item, item.expense, { year, monthIndex: month });

    if (total > 0) {
      tagTotals[item.tag.name] = (tagTotals[item.tag.name] || 0) + total;
    }
  });

  return Object.entries(tagTotals).map(([tag, total]) => ({
    tag,
    total: Number(total.toFixed(2)),
  }));
}

export function groupExpensesByStrategyPart(
  month: number,
  expenses: DBExpense[],
  transactions: DBTransaction[],
  // DBDuty declares `expense?: DBExpense`; callers join it in and use null for "no
  // matching expense", so the property is replaced rather than intersected.
  duties: (Omit<DBDuty, 'expense'> & {
    price: number;
    currency: Currency;
    expense: DBExpense | null;
  })[]
) {
  const year = new Date().getFullYear();
  const strategyTotals: Record<string, number> = {};
  const realTotals: Record<string, number> = {};
  const dutiesTotals: Record<string, number> = {};

  // Planned (from expenses)
  expenses.forEach((item) => {
    if (!item.strategyPart) return;

    const total = costInMonth(item, item.expense, { year, monthIndex: month });

    if (total > 0) {
      strategyTotals[item.strategyPart] = (strategyTotals[item.strategyPart] || 0) + total;
    }
  });

  // Real (from transactions)
  transactions.forEach((tx) => {
    if (!tx.strategyPart || !tx.transactionDate) return;
    const txDate = new Date(tx.transactionDate);

    if (txDate.getFullYear() !== year || txDate.getMonth() !== month) return;
    realTotals[tx.strategyPart] = (realTotals[tx.strategyPart] || 0) + tx.amount * -1;
  });

  // Duties (optional, sum by strategyPart for duties in this month)
  duties.forEach((duty) => {
    const strategyPart = duty.expense?.strategyPart;
    if (!strategyPart || !duty.executionDate) return;
    const dutyDate = new Date(duty.executionDate);
    if (dutyDate.getFullYear() !== year || dutyDate.getMonth() !== month || duty.transactionId)
      return;
    // You can add a value here if you want, e.g., count or sum, but duties may not have an amount

    if (dutiesTotals[strategyPart] === undefined) {
      dutiesTotals[strategyPart] = 0;
    }

    if (duty?.expense?.expense && duty?.resolved) {
      dutiesTotals[strategyPart] += duty.price;
    }
  });

  // Merge all keys
  const allParts = new Set([
    ...Object.keys(strategyTotals),
    ...Object.keys(realTotals),
    ...Object.keys(dutiesTotals),
  ]);

  return Array.from(allParts).map((strategyPart) => {
    return {
      strategyPart,
      planned: Number((strategyTotals[strategyPart] || 0).toFixed(2)),
      real: Number(
        ((realTotals[strategyPart] || 0) + (dutiesTotals[strategyPart] || 0)).toFixed(2)
      ),
    };
  });
}

export function calculateFinancialSafetyNet(month: number, data: DBExpense[]) {
  const results: Record<string, number> = {
    small: 0, // 3 months
    medium: 0, // 6 months
    comfort: 0, // 12 months
  };

  const year = new Date().getFullYear();

  data.forEach((item) => {
    if (!item.execution) return;

    // 3, 6, 12-months periods
    let totalSmall = 0;
    let totalMedium = 0;
    let totalComfort = 0;

    // Forward from the month asked about, so a window that runs past December carries on into
    // the next year rather than wrapping back to this one's January.
    for (let i = 0; i < 12; i++) {
      const cost = costInMonth(item, item.expense, {
        year: year + Math.floor((month + i) / 12),
        monthIndex: (month + i) % 12,
      });

      if (i < 3) totalSmall += cost;
      if (i < 6) totalMedium += cost;
      totalComfort += cost;
    }

    results.small += totalSmall;
    results.medium += totalMedium;
    results.comfort += totalComfort;
  });

  results.small *= 1.1;
  results.medium *= 1.1;
  results.comfort *= 1.1;

  return {
    small: Number(results.small.toFixed(2)),
    medium: Number(results.medium.toFixed(2)),
    comfort: Number(results.comfort.toFixed(2)),
  };
}

