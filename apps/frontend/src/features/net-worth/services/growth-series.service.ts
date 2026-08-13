import { toLocalDayKey } from '@/lib/dates.ts';
/** One day, and what everything came to on it. */
export type GrowthPoint = { on: Date; value: number };

/**
 * A reading, already in the currency the line is drawn in.
 *
 * Converted at **one** rate before it gets here — see the hook. At each reading's own day's rate the
 * line would rise and fall with the exchange rate, and a chart answering "is my wealth growing" would
 * be answering "did the złoty move" instead.
 */
type Reading = { positionId: string; value: number; valuedOn: Date; createdAt: Date };

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
      worthOf.set(reading.positionId, reading.value);
    }

    return {
      on: new Date(day),
      value: Number([...worthOf.values()].reduce((sum, value) => sum + value, 0).toFixed(2)),
    };
  });
};
