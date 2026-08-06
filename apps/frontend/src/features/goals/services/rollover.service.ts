import type { DBContribution } from '@/database/contributions.ts';
import type { DBClosedWindow, DBGoal, GoalDraft } from '@/database/goals.ts';

type RolloverInput = {
  goals: DBGoal[];
  contributions: DBContribution[];
  today: Date;
};

export type Rollover = {
  /** The goal whose window ended, and what to record about it. */
  closing: Omit<DBClosedWindow, 'id' | 'createdAt'>;
  /** The next window, ready to be created — same target, same series, empty pot. */
  opening: GoalDraft;
};

/** Which years-worth of a series have already been put to bed. */
const yearsAlreadyOpen = (goals: DBGoal[], seriesId: string): Set<number> =>
  new Set(goals.filter((goal) => goal.seriesId === seriesId).map((goal) => goal.year as number));

/**
 * The windows whose year has ended, with what to record and what to open in its place.
 *
 * **It asks nothing.** A year ending is not a decision — the allowance is simply gone and the new
 * year is a fresh agreement with yourself. The question *"reached, or given up?"* belongs to
 * closing a goal by hand and lives in #99.
 *
 * What leaves the pot arrives in the record, and that is the whole reason the record exists here
 * rather than with the monuments: without it the 26 000 that were there in December are nowhere in
 * January, and the lifetime figure has nothing to sum. #93 orders the releases *catches on → is
 * true → is a game*, and a year that ended is a fact.
 *
 * Idempotent by construction. A goal that has been closed is skipped, and so is one whose next
 * year already exists — the app is opened many times on the 2nd of January and this must produce
 * one new window, not one per visit.
 */
export const rolloversDue = ({ goals, contributions, today }: RolloverInput): Rollover[] =>
  goals.flatMap((goal) => {
    if (goal.year === undefined || !goal.seriesId || goal.closedAt) return [];
    if (goal.year >= today.getFullYear()) return [];
    if (yearsAlreadyOpen(goals, goal.seriesId).has(goal.year + 1)) return [];

    const contributed = Number(
      contributions
        .filter((contribution) => contribution.goalId === goal.id)
        .reduce((total, contribution) => total + contribution.amount, 0)
        .toFixed(2)
    );

    const deadline = goal.deadline ? new Date(goal.deadline) : new Date(goal.year, 11, 31);
    const nextYear = goal.year + 1;

    return [
      {
        closing: {
          goalId: goal.id,
          seriesId: goal.seriesId,
          year: goal.year,
          target: goal.target ?? 0,
          contributed,
          openedOn: new Date(goal.year, 0, 1),
          closedOn: deadline,
        },
        opening: {
          description: goal.description,
          strategyPart: goal.strategyPart,
          keepsItsMoney: goal.keepsItsMoney,
          target: goal.target,
          // The same days of the year the last window used: a holiday wanted by July is wanted by
          // July again, and an allowance that ran to the 31st runs to the 31st.
          deadline: new Date(nextYear, deadline.getMonth(), deadline.getDate()),
          year: nextYear,
          seriesId: goal.seriesId,
        },
      },
    ];
  });
