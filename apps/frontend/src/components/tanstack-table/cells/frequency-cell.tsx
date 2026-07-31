import { FREQUENCY, TOTAL } from '@/constant.ts';
import i18n from '@/i18n.ts';

type FrequencyCellProps = {
  id: string;
  frequency: FREQUENCY | undefined;
};

/**
 * How often a cost recurs, as a word.
 *
 * Plain text, matching the execution column beside it. Two earlier versions were worse: a
 * coloured dot spent the greens and ambers that mean *urgency* one column over, and the muted
 * outline badge that replaced it was the palest thing in the row and read as disabled.
 *
 * Colour in this table says exactly one thing — severity — which is what makes that dot worth
 * looking at.
 */
export default function FrequencyCell({ id, frequency }: FrequencyCellProps) {
  if (id === TOTAL || !frequency) {
    return null;
  }

  return <p>{i18n.t(frequency)}</p>;
}
