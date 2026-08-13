import { toLocalDayKey } from '@/lib/dates.ts';
import type { PositionKind } from '@/database/positions.ts';
/** One day, and what everything came to on it. */
export type GrowthPoint = { on: Date; value: number };

/**
 * A reading, already in the currency the line is drawn in.
 *
 * Converted at **one** rate before it gets here — see the hook. At each reading's own day's rate the
 * line would rise and fall with the exchange rate, and a chart answering "is my wealth growing" would
 * be answering "did the złoty move" instead.
 */
type Reading = {
  positionId: string;
  value: number;
  /**
   * Whether the reading is of something held or something owed.
   *
   * The line is net worth, so a debt has to come **off** it. Without this, summing every reading drew
   * the gross total with a mortgage counted as though somebody owned it — off by twice the debt.
   */
  kind: PositionKind;
  valuedOn: Date;
  createdAt: Date;
};

/**
 * What everything was worth, on every day anybody said anything about it.
 *
 * The answer to "is it growing" for the whole of somebody's wealth. Nothing gave it before: the change
 * column answers it per holding and only against that holding's own previous reading, and the only
 * chart with a time axis was the bonds projection.
 *
 * **Every other holding is carried forward at its last known worth.** A day when one account was
 * re-valued says nothing about the others, and summing only what moved would draw a line that dives
 * every time somebody values a single account — which is the shape of a bug, not of a portfolio.
 *
 * Two readings about one day are a correction rather than a contradiction, so the later saying wins.
 *
 * **What is owed comes off it.** The line is net worth, and a screenshot of a real spread is what caught
 * this: the axis sat at 1 129 000 while the figure above the chart said 308 800, because the mortgage
 * was being added. No unit test could see it — they had no holdings with a kind.
 *
 * **Nothing at all where there is one day to plot.** A line needs two points; an axis drawn around a
 * single dot says "flat" about a holding nobody has valued twice, which is a claim nobody has made.
 */
export const growthSeries = (readings: Reading[]): GrowthPoint[] => {
  const latestFirst = [...readings].sort(
    (a, b) =>
      new Date(a.valuedOn).getTime() - new Date(b.valuedOn).getTime() ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const days = [...new Set(latestFirst.map((reading) => toLocalDayKey(reading.valuedOn)))];

  if (days.length < 2) return [];

  const worthOf = new Map<string, number>();

  return days.map((day) => {
    for (const reading of latestFirst.filter((one) => toLocalDayKey(one.valuedOn) === day)) {
      worthOf.set(reading.positionId, reading.kind === 'liability' ? -reading.value : reading.value);
    }

    return {
      on: new Date(day),
      value: Number([...worthOf.values()].reduce((sum, value) => sum + value, 0).toFixed(2)),
    };
  });
};
