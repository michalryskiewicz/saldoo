export type ExpenseCategory = { tag: string; total: number };

/** Biggest first, which is the order a bar chart is read in and the question it answers. */
export const categoriesBySize = (categories: ExpenseCategory[]): ExpenseCategory[] =>
  [...categories].sort((one, other) => other.total - one.total);

/** A bar and the room around it, so a chart of three and a chart of twelve read the same. */
const ROW_HEIGHT = 32;

/** Below this a chart with one bar in it is a stripe rather than a picture. */
const MINIMUM_HEIGHT = 140;

/**
 * How tall the chart has to be for this many categories.
 *
 * A fixed box was what made the radar it replaces unreadable at both ends: one category
 * degenerated to a dot on a stick and filled half a screen doing it, and a dozen would have been
 * a scribble in the same space. Bars are the other way round — they need a row each, and the
 * height is a consequence of the data rather than a number chosen once.
 */
export const categoryChartHeight = (count: number): number =>
  Math.max(MINIMUM_HEIGHT, count * ROW_HEIGHT);
