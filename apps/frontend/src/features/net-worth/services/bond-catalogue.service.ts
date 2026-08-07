import { addMonths, endOfMonth, format, parse, startOfDay } from 'date-fns';
import type { BondDraft, BondInterest, BondPeriod } from '@/database/bonds.ts';

export type BondSeriesCode = 'ROR' | 'DOR' | 'TOS' | 'COI' | 'ROS' | 'EDO' | 'ROD';

/** What decides the rate once the first period is over — the part nobody can know in advance. */
export type LaterPeriods = 'fixed' | 'nbp-reference' | 'inflation';

export type BondSeriesSpec = {
  code: BondSeriesCode;
  /** How long it runs. Also what turns a purchase month into the series' published name. */
  tenorMonths: number;
  interest: BondInterest;
  period: BondPeriod;
  laterPeriods: LaterPeriods;
  /** Percentage points over the index, where there is one. */
  margin?: number;
  /** ROS and ROD are only sold to somebody drawing the child benefit. */
  familyOnly?: boolean;
};

/**
 * The retail series, by the three things the arithmetic runs on: how long, whether the interest
 * joins the capital, and how often.
 *
 * **This is structure, not price.** A series' shape has been the same for years and changes by
 * announcement, while the rate changes monthly — so they are kept apart, and only the rate needs a
 * record per month.
 *
 * **OTS is deliberately absent.** The three-month bond has a period this app cannot express:
 * `bondValueOn` counts whole months or whole years, and a quarter is neither. Filing it under
 * either would credit its interest at the wrong time, so it is left out until the period is modelled
 * in months rather than guessed at.
 */
export const BOND_SERIES: BondSeriesSpec[] = [
  { code: 'ROR', tenorMonths: 12, interest: 'pays out', period: 'monthly', laterPeriods: 'nbp-reference', margin: 0 },
  { code: 'DOR', tenorMonths: 24, interest: 'pays out', period: 'monthly', laterPeriods: 'nbp-reference', margin: 0.15 },
  { code: 'TOS', tenorMonths: 36, interest: 'compounds', period: 'yearly', laterPeriods: 'fixed' },
  { code: 'COI', tenorMonths: 48, interest: 'pays out', period: 'yearly', laterPeriods: 'inflation', margin: 1.5 },
  { code: 'ROS', tenorMonths: 72, interest: 'compounds', period: 'yearly', laterPeriods: 'inflation', margin: 2, familyOnly: true },
  { code: 'EDO', tenorMonths: 120, interest: 'compounds', period: 'yearly', laterPeriods: 'inflation', margin: 2 },
  { code: 'ROD', tenorMonths: 144, interest: 'compounds', period: 'yearly', laterPeriods: 'inflation', margin: 2.5, familyOnly: true },
];

/**
 * The first-period rate the Ministry announced, per month of sale.
 *
 * **Every entry here was read off a published offer.** A month that has not been read is absent
 * rather than filled in from the month beside it: rates hold still for long stretches and then
 * move, so interpolating would be right most of the time and confidently wrong about somebody's
 * money the rest of it. An absent month makes the app ask, which is the honest failure.
 *
 * Extending it is one line per month. Source: the Ministry's monthly offer announcement.
 */
export const OFFERS: Record<string, Partial<Record<BondSeriesCode, number>>> = {
  '2024-11': { ROR: 5.75, DOR: 5.9, TOS: 5.95, COI: 6.3, EDO: 6.55 },
  '2025-04': { ROR: 5.75, DOR: 5.9, TOS: 5.95, COI: 6.3, EDO: 6.55 },
  '2026-07': { ROR: 4, DOR: 4.15, TOS: 4.4, COI: 4.75, ROS: 5, EDO: 5.35, ROD: 5.6 },
  '2026-08': { ROR: 4, DOR: 4.15, TOS: 4.4, COI: 4.75, ROS: 5, EDO: 5.35, ROD: 5.6 },
};

/** `YYYY-MM`, the form a month is chosen and stored in. */
export type OfferMonth = string;

const monthStart = (month: OfferMonth): Date => parse(month, 'yyyy-MM', new Date());

export const seriesByCode = (code: BondSeriesCode): BondSeriesSpec =>
  BOND_SERIES.find((series) => series.code === code)!;

/**
 * The published name of what was bought — the series and the month it is **redeemed**, not the
 * month it was sold. A ten-year bought in August 2026 is EDO0836.
 */
export const seriesCodeFor = (code: BondSeriesCode, month: OfferMonth): string =>
  `${code}${format(addMonths(monthStart(month), seriesByCode(code).tenorMonths), 'MMyy')}`;

export const rateFor = (code: BondSeriesCode, month: OfferMonth): number | undefined =>
  OFFERS[month]?.[code];

/** What was on sale that month, in the order the Ministry lists them: shortest first. */
export const seriesOfferedIn = (month: OfferMonth): BondSeriesSpec[] =>
  BOND_SERIES.filter((series) => rateFor(series.code, month) !== undefined);

/** The months the catalogue can answer for, newest first. */
export const offerMonths = (): OfferMonth[] => Object.keys(OFFERS).sort().reverse();

/** The months a person can pick from, newest first — not only the ones the catalogue can price. */
export const recentMonths = (count: number, from: Date): OfferMonth[] =>
  Array.from({ length: count }, (_, index) => format(addMonths(from, -index), 'yyyy-MM'));

const CODE = /^(ROR|DOR|TOS|COI|ROS|EDO|ROD)(\d{2})(\d{2})$/;

/**
 * A holding read back into what it was chosen by, so opening one for editing shows a month and a
 * series rather than a form full of arithmetic. Nothing for a name somebody wrote themselves —
 * which is the signal to leave their figures alone.
 */
export const choiceFromCode = (
  description: string
): { code: BondSeriesCode; month: OfferMonth } | undefined => {
  const found = CODE.exec(description);
  if (!found) return undefined;

  const [, code, month, year] = found;
  const redeemed = new Date(2000 + Number(year), Number(month) - 1, 1);

  return {
    code: code as BondSeriesCode,
    month: format(addMonths(redeemed, -seriesByCode(code as BondSeriesCode).tenorMonths), 'yyyy-MM'),
  };
};

/**
 * Which day inside the chosen month to date the purchase.
 *
 * The end of it, so that whichever day it really was, no interest period is ever credited before it
 * is due — the same conservatism `bondValueOn` applies to a period part-way through, and the reason
 * a month is enough to ask for. Except in the month we are in, where the end of the month has not
 * happened: a holding dated in the future would be one the person does not hold yet.
 *
 * A day rather than an instant: `endOfMonth` lands on 23:59:59.999, which travels to another device
 * as a timestamp nobody meant and reads back as a different day in another timezone.
 */
const purchaseDay = (month: OfferMonth, today: Date): Date => {
  const end = startOfDay(endOfMonth(monthStart(month)));

  return end > today ? startOfDay(today) : end;
};

export type CatalogueChoice = {
  code: BondSeriesCode;
  month: OfferMonth;
  quantity: number;
  /**
   * What the person read off their own account, for a month this catalogue has never been told
   * about. It wins over the catalogue where both exist, because they are looking at the document.
   */
  ratePercent?: number;
  today?: Date;
};

/**
 * Everything a holding needs, worked out from the three things a person actually knows: when they
 * bought, which series, and how many.
 *
 * **Dated at the end of the month.** Whichever day inside it the purchase really was, this never
 * credits an interest period before it is due — the same conservatism `bondValueOn` applies to a
 * period part-way through, and the reason a month is enough to ask for.
 *
 * Returns nothing when the catalogue has no rate for that month and series, which is the signal to
 * ask the person instead of inventing one.
 */
export const draftFromCatalogue = ({
  code,
  month,
  quantity,
  ratePercent = rateFor(code, month),
  today = new Date(),
}: CatalogueChoice): BondDraft | undefined => {
  if (ratePercent === undefined) return undefined;

  const series = seriesByCode(code);

  return {
    description: seriesCodeFor(code, month),
    quantity,
    // Every retail series is sold at 100 złoty today, and the Ministry announces it per issue.
    nominal: 100,
    boughtOn: purchaseDay(month, today),
    ratePercent,
    interest: series.interest,
    period: series.period,
    currency: 'PLN',
  };
};
