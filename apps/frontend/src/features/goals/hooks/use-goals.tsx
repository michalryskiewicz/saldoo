import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { goalProgress, totalPutAside } from '@/features/goals/services/goal-progress.service.ts';
import { applyDBRollovers, isEmergencyFund } from '@/database/goals.ts';
import { rolloversDue } from '@/features/goals/services/rollover.service.ts';
import { confirmedPortion } from '@/features/goals/services/goal-months.service.ts';
import { useGoalRecords } from '@/features/goals/hooks/use-goal-records.tsx';

/**
 * Everything the goals screen draws, in one currency.
 *
 * The records and the conversion come from `useGoalRecords`, which the overview reads as well:
 * both screens are talking about the same money, and a second copy of the joining is a second
 * thing that can drift.
 */
export const useGoals = () => {
  const {
    currency,
    goals: convertedGoals,
    contributions: convertedContributions,
    asStored,
    inOneCurrency,
  } = useGoalRecords();

  const closedWindows = useLiveQuery(() => db.closedWindows.toArray(), []) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray(), []) || [];

  const today = new Date();

  // The turn of the year, applied when somebody next opens the screen. There is no clock running
  // in a local-first app that may be shut for a fortnight, so the work happens on the first visit
  // of the new year instead — which is also the first moment it could be seen.
  //
  // The guard is a ref rather than the effect's own dependencies: `useLiveQuery` re-emits the
  // moment the first write lands, and without it the second pass would start before the first had
  // finished writing the goal that makes it a no-op.
  const rollingOver = useRef(false);

  useEffect(() => {
    const due = rolloversDue({
      goals: asStored.goals,
      contributions: asStored.contributions,
      today: new Date(),
    });

    if (!due.length || rollingOver.current) return;

    rollingOver.current = true;
    applyDBRollovers(due).finally(() => {
      rollingOver.current = false;
    });
  }, [asStored.goals, asStored.contributions]);

  return {
    currency,
    hasEmergencyFund: convertedGoals.some(isEmergencyFund),
    progress: goalProgress({
      goals: convertedGoals,
      contributions: convertedContributions,
      closedWindows,
      expenses: inOneCurrency(expenses, 'expense') as typeof expenses,
      today,
    }),
    totalPutAside: totalPutAside({
      goals: convertedGoals,
      contributions: convertedContributions,
    }),
    // Beside the figure, never instead of it: a contribution with nothing behind it is most often
    // a transfer somebody meant to make and did, days before their bank got round to saying so.
    confirmed: confirmedPortion(
      convertedContributions.filter((contribution) =>
        convertedGoals.some(
          (goal) => goal.id === contribution.goalId && !isEmergencyFund(goal)
        )
      )
    ).confirmed,
  };
};
