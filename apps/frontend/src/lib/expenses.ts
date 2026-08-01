import type { DBExpense } from '@/database/expenses';
import {
  countWeekdaysInMonth,
  daysInMonth,
  getDaysArrayOfYear,
  getFromDate,
  isDateInRange,
  MONTHS,
} from './dates';
import type { DBProfit } from '@/database/profits.ts';
import { getISOWeek, isValid } from 'date-fns';
import type { DBTransaction } from '@/database/transactions.ts';
import type { DBDuty } from '@/database/duty.ts';
import type { Currency } from '@/constant.ts';
import type { DBTag } from '@/database/tags.ts';
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

  data.forEach((item) => {
    if (!item.execution) return;
    const { year, month, day } = getFromDate(item.execution);

    switch (item.frequency) {
      case 'YEARLY': {
        if (month < 0) return;
        ensureMonth(month);
        addToMonth(month, item.severity, item.expense);
        break;
      }
      case 'MONTHLY': {
        for (let m = 0; m < 12; m++) {
          ensureMonth(m);
          addToMonth(m, item.severity, item.expense);
        }
        break;
      }
      case 'WEEKLY': {
        for (let m = 0; m < 12; m++) {
          const count = countWeekdaysInMonth(year, m, day);
          ensureMonth(m);
          addToMonth(m, item.severity, item.expense * count);
        }
        break;
      }
      case 'DAILY': {
        for (let m = 0; m < 12; m++) {
          const count = daysInMonth(year, m);
          ensureMonth(m);
          addToMonth(m, item.severity, item.expense * count);
        }
        break;
      }
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

export function getExpensesInSelectedDateRange(
  expenses: DBExpense[],
  { start, end }: { start: Date; end: Date }
) {
  return expenses.filter((e) => {
    if (e.frequency === 'YEARLY' && e.execution) {
      return isDateInRange(e.execution, start, end);
    }

    return true;
  });
}

export function groupExpensesAndProfitsByMonth(expenses: DBExpense[], profits: DBProfit[]) {
  const expenseResult: number[] = Array(12).fill(0);

  // Group expenses by month
  expenses.forEach((item) => {
    const { year, month, day } = getFromDate(item.execution);
    switch (item.frequency) {
      case 'YEARLY': {
        if (!isValid(item.execution)) return;
        expenseResult[month] = expenseResult[month] + item.expense;
        break;
      }
      case 'MONTHLY': {
        for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
          expenseResult[monthIndex] = expenseResult[monthIndex] + item.expense;
        }
        break;
      }
      case 'WEEKLY': {
        if (!isValid(item.execution)) return;
        for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
          const count = countWeekdaysInMonth(year, monthIndex, day);
          expenseResult[monthIndex] = expenseResult[monthIndex] + item.expense * count;
        }
        break;
      }
      case 'DAILY': {
        if (!isValid(item.execution)) return;
        for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
          const count = daysInMonth(year, monthIndex);
          expenseResult[monthIndex] = expenseResult[monthIndex] + item.expense * count;
        }
        break;
      }
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

    const { month: itemMonth, day: weekday } = getFromDate(item.execution);
    let include = false;
    let total = 0;

    switch (item.frequency) {
      case 'YEARLY':
        include = !!item.execution && itemMonth === month;
        total = item.expense;
        break;
      case 'MONTHLY':
        include = true;
        total = item.expense;
        break;
      case 'WEEKLY': {
        if (!item.execution) break;
        const count = countWeekdaysInMonth(year, month, weekday);
        include = count > 0;
        total = item.expense * count;
        break;
      }
      case 'DAILY': {
        if (!item.execution) break;
        include = true;
        const count = daysInMonth(year, month);
        total = item.expense * count;
        break;
      }
    }

    if (include) {
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
    const { month: itemMonth, day: weekday } = getFromDate(item.execution);
    let include = false;
    let total = 0;
    switch (item.frequency) {
      case 'YEARLY':
        include = !!item.execution && itemMonth === month;
        total = item.expense;
        break;
      case 'MONTHLY':
        include = true;
        total = item.expense;
        break;
      case 'WEEKLY': {
        if (!item.execution) break;
        const weekCount = countWeekdaysInMonth(year, month, weekday);
        include = weekCount > 0;
        total = item.expense * weekCount;
        break;
      }
      case 'DAILY': {
        if (!item.execution) break;
        include = true;
        const dayCount = daysInMonth(year, month);
        total = item.expense * dayCount;
        break;
      }
    }
    if (include) {
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

    const { month: expenseMonth, day: expenseDay } = getFromDate(item.execution);

    // 3, 6, 12-months periods
    let totalSmall = 0;
    let totalMedium = 0;
    let totalComfort = 0;

    switch (item.frequency) {
      case 'YEARLY': {
        // Only add if the yearly expense falls within the period
        const relMonth = (expenseMonth - month + 12) % 12;
        if (relMonth < 12) totalComfort += item.expense;
        if (relMonth < 6) totalMedium += item.expense;
        if (relMonth < 3) totalSmall += item.expense;
        break;
      }
      case 'MONTHLY': {
        for (let i = 0; i < 12; i++) {
          if (i < 3) totalSmall += item.expense;
          if (i < 6) totalMedium += item.expense;
          totalComfort += item.expense;
        }
        break;
      }
      case 'WEEKLY': {
        for (let i = 0; i < 12; i++) {
          const m = (month + i) % 12;
          const weeks = countWeekdaysInMonth(year, m, expenseDay);
          if (i < 3) totalSmall += item.expense * weeks;
          if (i < 6) totalMedium += item.expense * weeks;
          totalComfort += item.expense * weeks;
        }
        break;
      }
      case 'DAILY': {
        for (let i = 0; i < 12; i++) {
          const m = (month + i) % 12;
          const days = daysInMonth(year, m);
          if (i < 3) totalSmall += item.expense * days;
          if (i < 6) totalMedium += item.expense * days;
          totalComfort += item.expense * days;
        }
        break;
      }
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

type ContributionDay = {
  week: number;
  day: number;
  date: number;
  month: number;
  year: number;
  value: number;
  amount: number;
  currency: Currency | '';
};

export function generateContributionData(transactions: DBTransaction[]) {
  const data: ContributionDay[] = [];
  const today = new Date();
  const currentYear = today.getFullYear();

  // Filter transactions for the current year, skip null dates
  const filteredTransactions = transactions.filter((t) => {
    if (!t.transactionDate) return false;
    const date = new Date(t.transactionDate);
    return date.getFullYear() === currentYear;
  });

  const daysOfYearArray = getDaysArrayOfYear(currentYear);

  daysOfYearArray.forEach((day) => {
    const transactionsInSelectedDay = filteredTransactions.filter((t) => {
      const tDate = new Date(t.transactionDate);
      return (
        tDate.getFullYear() === day.getFullYear() &&
        tDate.getMonth() === day.getMonth() &&
        tDate.getDate() === day.getDate()
      );
    });

    data.push({
      week: getISOWeek(day),
      day: day.getDay(),
      date: day.getDate(),
      month: day.getMonth(),
      year: day.getFullYear(),
      value: transactionsInSelectedDay.length,
      amount: transactionsInSelectedDay.reduce((acc, curr) => (acc += curr.amount), 0),
      currency: transactionsInSelectedDay?.[0]?.currency || '',
    });
  });

  return data;
}
