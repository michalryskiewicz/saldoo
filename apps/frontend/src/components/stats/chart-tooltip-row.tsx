type ChartTooltipRowProps = {
  /** The series' own colour, so the row is tied to the line or block it describes. */
  color?: string;
  label: string;
  value: string;
};

/**
 * One line of a chart tooltip: which series, and what it reads.
 *
 * The swatch is the whole point. `ChartTooltipContent` draws one itself, but only on the branch it
 * takes when nobody passes a `formatter` — hand it one and the entire row becomes the formatter's
 * output, indicator included. Both charts here pass one, to print money the way the rest of the app
 * prints it, and both quietly lost the only thing tying a figure to the line it came from. A
 * two-line chart left somebody guessing; the net worth chart, which can carry half a dozen
 * segments, left them counting.
 *
 * The colour comes from the payload rather than from a `var(--color-<name>)` built out of the
 * series key: the net worth chart keys its segments by record id, and a custom property named
 * after one is not something to rely on.
 */
export const ChartTooltipRow = ({ color, label, value }: ChartTooltipRowProps) => (
  <>
    <div
      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
      style={{ backgroundColor: color }}
      data-slot="tooltip-swatch"
    />
    <div className="flex flex-1 items-center justify-between gap-3 leading-none">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  </>
);
