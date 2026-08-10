import type { Currency } from '@/constant.ts';
import type { DBValuation } from '@/database/valuations.ts';

/** What somebody said a holding is worth, and when they said it was worth that. */
type Reading = { value: number; valuedOn: Date };

/**
 * Whether saving a holding says anything new about its worth.
 *
 * Saving is not always saying: renaming a holding, or pointing it at a goal, goes through the same
 * form. Filing a valuation every time would fill the history with rows that carry no fact and send
 * each of them to the other device.
 *
 * The same figure about a *later* day does say something — it is somebody confirming it still holds,
 * which is exactly what an unchanged investment looks like.
 */
export const isNewReading = (next: Reading, stored: Reading | undefined): boolean =>
  !stored ||
  next.value !== stored.value ||
  new Date(next.valuedOn).getTime() !== new Date(stored.valuedOn).getTime();

/** What a holding has done since the reading before its latest one. */
export type ValuationChange = {
  /** Which holding moved, so a converted change can be matched back to its row. */
  positionId: string;
  /** Signed: a holding that fell says so. */
  amount: number;
  currency: Currency;
  /** The day of the reading this is measured from, so the change can say over what. */
  since: Date;
  /**
   * The day of the latest reading — the one day a change shown in another currency may be converted
   * at.
   *
   * Converting the two readings at their own days' rates would fold the rate's drift into the
   * answer and report a holding as having grown when nothing about the holding moved. One rate for
   * both is the only way the figure stays a fact about the holding.
   */
  on: Date;
};

const round = (amount: number) => Number(amount.toFixed(2));

/**
 * Newest first, and a correction ahead of what it corrects.
 *
 * `valuedOn` is the day somebody is talking about and `createdAt` is when they said it, so two
 * readings of the same day are a correction rather than a contradiction — and the later saying is
 * the one that counts. Sorted rather than trusted: two devices file their own history and the
 * projector writes whichever update reaches it first, so the order of the list is not a fact.
 */
const latestFirst = (history: DBValuation[]): DBValuation[] =>
  [...history].sort(
    (a, b) =>
      new Date(b.valuedOn).getTime() - new Date(a.valuedOn).getTime() ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

/**
 * What a holding has done since anybody last looked at it.
 *
 * The fact a stored value cannot express on its own, and the one that turns a list of holdings into
 * something a decision can be read from: 31 500 says nothing, and *up 1 500 since May* says what
 * happened.
 *
 * **Nothing at all where there is no before.** A holding valued once has not stayed flat — it has no
 * previous reading, and nought would claim it did. That distinction is the whole reason this returns
 * an absence rather than a zero.
 *
 * Compared against the day before, never against a figure that a correction replaced: two readings
 * for one day are somebody fixing what they said, not the holding moving twice.
 */
export const changeSincePrevious = (
  positionId: string,
  history: DBValuation[]
): ValuationChange | undefined => {
  const readings = latestFirst(history.filter((one) => one.positionId === positionId));

  const [latest] = readings;
  const previous = readings.find(
    (one) => new Date(one.valuedOn).getTime() < new Date(latest?.valuedOn ?? 0).getTime()
  );

  if (!latest || !previous) return undefined;

  return {
    positionId,
    amount: round(latest.value - previous.value),
    currency: latest.currency,
    since: new Date(previous.valuedOn),
    on: new Date(latest.valuedOn),
  };
};
