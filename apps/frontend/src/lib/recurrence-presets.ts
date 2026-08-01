import { FREQUENCY } from '@/constant.ts';
import type { Recurrence } from '@/lib/recurrence.ts';

/**
 * The cadences people actually name, and the escape hatch for the ones they do not.
 *
 * A unit and a step are what the rule needs, but they are not how anybody says it: "co kwartał"
 * is one answer, and asking for it as "Miesięczna" plus "3" makes the reader assemble a sentence
 * the form could have said itself. So the named ones are offered whole, and `CUSTOM` is what
 * keeps every other cadence expressible — without it this would be the enum #91 rejected.
 */
export const CADENCE = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  FOUR_WEEKLY: 'FOUR_WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  HALF_YEARLY: 'HALF_YEARLY',
  YEARLY: 'YEARLY',
  CUSTOM: 'CUSTOM',
} as const;

export type Cadence = (typeof CADENCE)[keyof typeof CADENCE];

type NamedCadence = { frequency: FREQUENCY; interval: number };

const NAMED: Record<Exclude<Cadence, 'CUSTOM'>, NamedCadence> = {
  [CADENCE.DAILY]: { frequency: FREQUENCY.DAILY, interval: 1 },
  [CADENCE.WEEKLY]: { frequency: FREQUENCY.WEEKLY, interval: 1 },
  [CADENCE.BIWEEKLY]: { frequency: FREQUENCY.WEEKLY, interval: 2 },
  [CADENCE.FOUR_WEEKLY]: { frequency: FREQUENCY.WEEKLY, interval: 4 },
  [CADENCE.MONTHLY]: { frequency: FREQUENCY.MONTHLY, interval: 1 },
  [CADENCE.QUARTERLY]: { frequency: FREQUENCY.MONTHLY, interval: 3 },
  [CADENCE.HALF_YEARLY]: { frequency: FREQUENCY.MONTHLY, interval: 6 },
  [CADENCE.YEARLY]: { frequency: FREQUENCY.YEARLY, interval: 1 },
};

/** The order the choices are offered in: shortest first, and the escape hatch last. */
export const CADENCES_IN_ORDER: Cadence[] = [
  CADENCE.DAILY,
  CADENCE.WEEKLY,
  CADENCE.BIWEEKLY,
  CADENCE.FOUR_WEEKLY,
  CADENCE.MONTHLY,
  CADENCE.QUARTERLY,
  CADENCE.HALF_YEARLY,
  CADENCE.YEARLY,
  CADENCE.CUSTOM,
];

/** What a named cadence means to the rule, or nothing when the person is spelling it out. */
export const cadenceOf = (cadence: Cadence): NamedCadence | undefined =>
  cadence === CADENCE.CUSTOM ? undefined : NAMED[cadence];

type FormValues = { cadence?: string; frequency?: string; interval?: number };

/**
 * A form's answers with the named cadence resolved into the unit and step a record stores.
 *
 * `cadence` is how the question was asked, not something the app knows about a cost. Left in the
 * payload it would be written to the document, travel to the other device and outlive the form
 * that invented it.
 */
export const withResolvedCadence = <T extends FormValues>({
  cadence,
  ...values
}: T): Omit<T, 'cadence'> => {
  const named = cadence ? cadenceOf(cadence as Cadence) : undefined;

  return named ? { ...values, frequency: named.frequency, interval: named.interval } : values;
};

/**
 * The name of a stored recurrence, so reopening it shows the answer that was given.
 *
 * An absent interval is every one — that is what every recurrence stored before intervals
 * existed means, and reading it as anything else would open the form on a cadence nobody chose.
 */
export const presetFor = ({ frequency, interval }: Recurrence): Cadence | undefined => {
  if (!frequency) return undefined;

  const every = interval ?? 1;
  const named = CADENCES_IN_ORDER.filter((cadence) => cadence !== CADENCE.CUSTOM).find(
    (cadence) => {
      const meaning = NAMED[cadence as Exclude<Cadence, 'CUSTOM'>];

      return meaning.frequency === frequency && meaning.interval === every;
    }
  );

  return named ?? CADENCE.CUSTOM;
};
