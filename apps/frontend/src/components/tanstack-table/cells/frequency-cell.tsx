import { FREQUENCY, TOTAL } from '@/constant.ts';
import { Badge } from '@/components/ui/badge.tsx';
import i18n from '@/i18n.ts';

type FrequencyCellProps = {
  id: string;
  frequency: FREQUENCY | undefined;
};

/**
 * How often a cost recurs, as a word.
 *
 * There is deliberately no coloured dot. The label already said "Tygodniowa", so the dot
 * carried nothing the reader did not have — and blue/green/amber/purple are assigned
 * categories rather than a scale anybody can learn. It also spent the same greens and ambers
 * that mean *urgency* one column over, so a row said green twice about two unrelated things.
 *
 * Colour in this table now says exactly one thing, which is what makes the severity dot worth
 * looking at.
 */
export default function FrequencyCell({ id, frequency }: FrequencyCellProps) {
  if (id === TOTAL || !frequency) {
    return null;
  }

  return (
    <Badge variant="outline" className="text-muted-foreground px-1.5 font-normal">
      {i18n.t(frequency)}
    </Badge>
  );
}
