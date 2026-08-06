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
import { survivesIncomeLoss } from '@/lib/safety-net.ts';
import { expenseAmountForMonth } from '@/lib/expense-amount.ts';
import { hasLostItsBase } from '@/lib/percentage-of-income.ts';
import type { DBGoal } from '@/database/goals.ts';
import type { DBContribution } from '@/database/contributions.ts';
import { requiredMonthlyContribution } from '@/lib/goals.ts';

type MonthTotals = {
  total: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  irreducible: number;
  reducible: number;
};

/**
 * Each month of the year, split two ways at once: by priority, and by what would still be owed
 * with no income coming in.
 *
 * Both splits, because they are different questions and the chart offers a tab for each. Priority
 * is how urgent a cost is; irreducibility is whether it can be cut at all, and that second one is
 * the figure the emergency fund is built from — so the chart and the fund can never disagree.
 *
 * A cost with no priority still counts towards the month's total; it simply has no priority bucket
 * to land in. Indexing by a null priority would invent one. It always lands in one of the other
 * two: every cost has an answer to whether it survives, given or derived.
 */
export function groupExpensesByMonth(data: DBExpense[], profits: DBProfit[] = []) {
  const result: Record<number, MonthTotals> = {};

  const ensureMonth = (month: number) => {
    if (!result[month])
      result[month] = { total: 0, HIGH: 0, MEDIUM: 0, LOW: 0, irreducible: 0, reducible: 0 };
  };

  const addToMonth = (
    month: number,
    severity: DBExpense['severity'],
    survives: boolean,
    value: number
  ) => {
    if (severity) result[month][severity] += value;
    result[month][survives ? 'irreducible' : 'reducible'] += value;
    result[month].total += value;
  };

  const year = new Date().getFullYear();

  data.forEach((item) => {
    if (!item.execution) return;
    if (hasLostItsBase(item, profits)) return;

    const survives = survivesIncomeLoss(item);

    for (let m = 0; m < 12; m++) {
      const month = { year, monthIndex: m };

      ensureMonth(m);
      addToMonth(
        m,
        item.severity,
        survives,
        costInMonth(item, expenseAmountForMonth(item, profits, month), month)
      );
    }
  });

  return MONTHS.map((_, m) => ({
    month: m,
    total: Number(result[m]?.total?.toFixed(2)) || 0,
    high: Number(result[m]?.HIGH?.toFixed(2)) || 0,
    medium: Number(result[m]?.MEDIUM?.toFixed(2)) || 0,
    low: Number(result[m]?.LOW?.toFixed(2)) || 0,
    irreducible: Number(result[m]?.irreducible?.toFixed(2)) || 0,
    reducible: Number(result[m]?.reducible?.toFixed(2)) || 0,
  }));
}

export function groupExpensesAndProfitsByMonth(expenses: DBExpense[], profits: DBProfit[]) {
  const expenseResult: number[] = Array(12).fill(0);

  const year = new Date().getFullYear();

  expenses.forEach((item) => {
    if (item.execution && !isValid(new Date(item.execution))) return;
    if (hasLostItsBase(item, profits)) return;

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const month = { year, monthIndex };

      expenseResult[monthIndex] += costInMonth(
        item,
        expenseAmountForMonth(item, profits, month),
        month
      );
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

export function groupExpensesByCategory(
  month: number,
  data: (DBExpense & { tag?: DBTag })[],
  profits: DBProfit[] = []
) {
  const year = new Date().getFullYear();
  const tagTotals: Record<string, number> = {};

  data.forEach((item) => {
    if (!item.tag?.name) return;
    if (hasLostItsBase(item, profits)) return;

    const calendarMonth = { year, monthIndex: month };
    const total = costInMonth(item, expenseAmountForMonth(item, profits, calendarMonth), calendarMonth);

    if (total > 0) {
      tagTotals[item.tag.name] = (tagTotals[item.tag.name] || 0) + total;
    }
  });

  return Object.entries(tagTotals).map(([tag, total]) => ({
    tag,
    total: Number(total.toFixed(2)),
  }));
}

/** An occurrence as the callers hand it over, with the cost that produced it joined in. */
export type PricedDuty = Omit<DBDuty, 'expense'> & {
  price: number;
  currency: Currency;
  // DBDuty declares `expense?: DBExpense`; callers join it in and use null for "no
  // matching expense", so the property is replaced rather than intersected.
  expense: DBExpense | null;
};

export type StrategyPartsForMonth = {
  monthIndex: number;
  expenses: DBExpense[];
  transactions: DBTransaction[];
  duties: PricedDuty[];
  profits?: DBProfit[];
  goals?: DBGoal[];
  contributions?: DBContribution[];
};

/**
 * Where one month's money went, by part of the budgeting strategy — planned against real.
 *
 * Named for what it computes rather than for the table it started with. It reads four sources and
 * is about to read a fifth, and "grouping expenses" stopped describing it somewhere around the
 * third: a positional argument list nobody can read at the call site is how a source gets passed
 * in the wrong slot.
 */
export function strategyPartsForMonth({
  monthIndex: month,
  expenses,
  transactions,
  duties,
  profits = [],
  goals = [],
  contributions = [],
}: StrategyPartsForMonth) {
  const year = new Date().getFullYear();
  const strategyTotals: Record<string, number> = {};
  const realTotals: Record<string, number> = {};
  const dutiesTotals: Record<string, number> = {};

  // Planned (from expenses)
  expenses.forEach((item) => {
    if (!item.strategyPart) return;
    if (hasLostItsBase(item, profits)) return;

    const calendarMonth = { year, monthIndex: month };
    const total = costInMonth(item, expenseAmountForMonth(item, profits, calendarMonth), calendarMonth);

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
    if (dutiesTotals[strategyPart] === undefined) {
      dutiesTotals[strategyPart] = 0;
    }

    // On `resolved` alone. This used to also require `duty.expense.expense` to be truthy, which is
    // a test of the amount and not of whether there is a cost behind the occurrence — and a share of
    // an income holds zero there, so every tax the person had actually paid was thrown away before
    // it reached the tile.
    if (duty.resolved) {
      dutiesTotals[strategyPart] += duty.price;
    }
  });

  // Goals, on both sides.
  //
  // The planned side is the one that is easy to forget and the reason this is here at all: planned
  // comes from expenses, so the moment a cost stops being an expense and becomes a goal, planned
  // savings would drop to zero — and the tile would report somebody who had just organised their
  // retirement saving as planning to save nothing.
  //
  // The part is the goal's own, never guessed. A strategy with two savings parts is what defeated
  // every attempt to derive it: a window is not a horizon, and IKE's yearly window would make
  // retirement savings short-term.
  goals.forEach((goal) => {
    if (!goal.strategyPart || goal.closedAt) return;

    const saved = contributions
      .filter((contribution) => contribution.goalId === goal.id)
      .reduce((total, contribution) => total + contribution.amount, 0);

    const required = goal.deadline
      ? requiredMonthlyContribution(
          { target: goal.target ?? 0, saved, deadline: goal.deadline },
          new Date(year, month, 1)
        )
      : (goal.monthlyPace ?? 0);

    if (required > 0) {
      strategyTotals[goal.strategyPart] = (strategyTotals[goal.strategyPart] || 0) + required;
    }

    // Seeded even at zero, so a goal with nothing in it this month still shows its part on the
    // tile rather than vanishing from a screen it is planned on.
    realTotals[goal.strategyPart] = realTotals[goal.strategyPart] || 0;
  });

  contributions.forEach((contribution) => {
    const goal = goals.find((candidate) => candidate.id === contribution.goalId);
    if (!goal?.strategyPart) return;

    const day = new Date(contribution.contributedAt);
    if (day.getFullYear() !== year || day.getMonth() !== month) return;

    realTotals[goal.strategyPart] = (realTotals[goal.strategyPart] || 0) + contribution.amount;
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

/**
 * What has to be put aside to live for three, six or twelve months with no income at all.
 *
 * Only costs that would still be there once the income stops. A fund sized on everything a
 * person spends answers a different question — what their life costs — and would demand they
 * save up for a year of the gym membership they would cancel in the first week.
 */
export function calculateFinancialSafetyNet(month: number, data: DBExpense[]) {
  const results: Record<string, number> = {
    small: 0, // 3 months
    medium: 0, // 6 months
    comfort: 0, // 12 months
  };

  const year = new Date().getFullYear();

  data.forEach((item) => {
    if (!item.execution) return;
    if (!survivesIncomeLoss(item)) return;

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

