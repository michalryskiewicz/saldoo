import { addMonths, differenceInCalendarMonths, endOfMonth, format, parse, startOfDay } from 'date-fns';
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

/** A rate that held from this month until the next entry above it. */
export type RateRange = [from: OfferMonth, ratePercent: number];

export type SeriesRates = {
  /**
   * The last month whose offer has been read. Beyond it the catalogue knows nothing — the Ministry
   * announces one month at a time, so next month's rate does not exist yet, and carrying this
   * month's forward would be the app inventing the very number it is meant to look up.
   */
  until: OfferMonth;
  /** Newest first. The oldest entry is also the month the series first went on sale. */
  ranges: RateRange[];
};

/**
 * The first-period rate of every series, month by month, as ranges.
 *
 * **Ranges rather than a row per month, and it is lossless.** Every month between the oldest entry
 * and `until` was read; a rate simply holds still for stretches and then moves, so one entry per
 * move says exactly what a row per month would, in a fifth of the space and in a form somebody can
 * actually check.
 *
 * **Where the numbers come from.** Each series' published history, cross-checked against the
 * Ministry's own offer announcements on every month this app had already recorded independently —
 * 2024-11, 2025-04, 2026-07 and 2026-08 — which agreed on all four for all of ROR, DOR, TOS, COI
 * and EDO. One month was missing from the history (EDO, July 2018) and was taken from the issue's
 * own page rather than assumed from its neighbours, which happened to hold the same rate.
 *
 * **A series absent from a month is absent from the offer.** ROR and DOR did not exist before June
 * 2022 and TOS before August 2022, so a purchase in 2019 is offered EDO, COI, ROS and ROD and
 * nothing else — which is what was actually on sale.
 *
 * Keeping it current is one entry per month, and only when a rate moves.
 */
export const RATES: Record<BondSeriesCode, SeriesRates> = {
  ROR: {
    until: '2026-08',
    ranges: [
      ['2026-04', 4.0],
      ['2025-12', 4.25],
      ['2025-11', 4.5],
      ['2025-10', 4.75],
      ['2025-08', 5.0],
      ['2025-06', 5.25],
      ['2024-09', 5.75],
      ['2024-06', 5.95],
      ['2024-02', 6.05],
      ['2024-01', 6.15],
      ['2023-11', 6.25],
      ['2023-10', 6.5],
      ['2022-10', 6.75],
      ['2022-08', 6.5],
      ['2022-07', 6.0],
      ['2022-06', 5.25],
    ],
  },
  DOR: {
    until: '2026-08',
    ranges: [
      ['2026-04', 4.15],
      ['2025-12', 4.4],
      ['2025-11', 4.65],
      ['2025-10', 4.9],
      ['2025-08', 5.15],
      ['2025-06', 5.4],
      ['2024-09', 5.9],
      ['2024-06', 6.15],
      ['2024-02', 6.3],
      ['2024-01', 6.4],
      ['2023-11', 6.5],
      ['2023-10', 6.75],
      ['2022-10', 6.85],
      ['2022-08', 6.75],
      ['2022-07', 6.25],
      ['2022-06', 5.5],
    ],
  },
  TOS: {
    until: '2026-08',
    ranges: [
      ['2026-04', 4.4],
      ['2025-12', 4.65],
      ['2025-11', 4.9],
      ['2025-10', 5.15],
      ['2025-08', 5.4],
      ['2025-06', 5.65],
      ['2025-05', 5.75],
      ['2024-09', 5.95],
      ['2024-06', 6.2],
      ['2024-02', 6.4],
      ['2024-01', 6.5],
      ['2023-11', 6.6],
      ['2022-10', 6.85],
      ['2022-08', 6.5],
    ],
  },
  COI: {
    until: '2026-08',
    ranges: [
      ['2026-04', 4.75],
      ['2025-12', 5.0],
      ['2025-11', 5.25],
      ['2025-10', 5.5],
      ['2025-08', 5.75],
      ['2025-06', 6.0],
      ['2025-05', 6.1],
      ['2024-09', 6.3],
      ['2024-02', 6.55],
      ['2024-01', 6.65],
      ['2023-11', 6.75],
      ['2022-10', 7.0],
      ['2022-08', 6.5],
      ['2022-07', 6.0],
      ['2022-06', 5.5],
      ['2022-05', 3.3],
      ['2022-04', 2.3],
      ['2022-02', 1.8],
      ['2020-05', 1.3],
      ['2019-01', 2.4],
    ],
  },
  ROS: {
    until: '2026-08',
    ranges: [
      ['2026-04', 5.0],
      ['2025-12', 5.2],
      ['2025-11', 5.45],
      ['2025-10', 5.7],
      ['2025-08', 5.95],
      ['2025-06', 6.2],
      ['2025-05', 6.3],
      ['2024-09', 6.5],
      ['2024-02', 6.75],
      ['2024-01', 6.85],
      ['2023-11', 6.95],
      ['2022-10', 7.2],
      ['2022-08', 6.7],
      ['2022-07', 6.2],
      ['2022-06', 5.7],
      ['2022-05', 3.5],
      ['2022-04', 2.5],
      ['2022-02', 2.0],
      ['2020-05', 1.5],
      ['2016-12', 2.8],
      ['2016-10', 2.6],
    ],
  },
  EDO: {
    until: '2026-08',
    ranges: [
      ['2026-04', 5.35],
      ['2025-12', 5.6],
      ['2025-11', 5.75],
      ['2025-08', 6.0],
      ['2025-06', 6.25],
      ['2025-05', 6.35],
      ['2024-09', 6.55],
      ['2024-02', 6.8],
      ['2024-01', 6.9],
      ['2023-11', 7.0],
      ['2022-10', 7.25],
      ['2022-08', 6.75],
      ['2022-07', 6.25],
      ['2022-06', 5.75],
      ['2022-05', 3.7],
      ['2022-04', 2.7],
      ['2022-02', 2.2],
      ['2020-05', 1.7],
      ['2016-12', 2.7],
      ['2016-01', 2.5],
    ],
  },
  ROD: {
    until: '2026-08',
    ranges: [
      ['2026-04', 5.6],
      ['2025-12', 5.85],
      ['2025-11', 6.0],
      ['2025-08', 6.25],
      ['2025-06', 6.5],
      ['2025-05', 6.6],
      ['2024-09', 6.8],
      ['2024-02', 7.05],
      ['2024-01', 7.15],
      ['2023-11', 7.25],
      ['2022-10', 7.5],
      ['2022-08', 7.0],
      ['2022-07', 6.5],
      ['2022-06', 6.0],
      ['2022-05', 4.0],
      ['2022-04', 3.0],
      ['2022-02', 2.5],
      ['2020-05', 2.0],
      ['2016-12', 3.2],
      ['2016-10', 3.0],
    ],
  },
};

/** `YYYY-MM`, the form a month is chosen and stored in. */
export type OfferMonth = string;

/** The first day of an offer month, which is what every date in here is measured from. */
export const monthStart = (month: OfferMonth): Date => parse(month, 'yyyy-MM', new Date());

export const seriesByCode = (code: BondSeriesCode): BondSeriesSpec =>
  BOND_SERIES.find((series) => series.code === code)!;

/**
 * The published name of what was bought — the series and the month it is **redeemed**, not the
 * month it was sold. A ten-year bought in August 2026 is EDO0836.
 */
export const seriesCodeFor = (code: BondSeriesCode, month: OfferMonth): string =>
  `${code}${format(addMonths(monthStart(month), seriesByCode(code).tenorMonths), 'MMyy')}`;

/**
 * The first-period rate that series carried that month, or nothing at all.
 *
 * Nothing in two cases, and both are honest answers rather than gaps to paper over: a month before
 * the series went on sale, and a month past the last offer anybody has read. The second is the one
 * that comes round — the Ministry announces one month at a time, so on the first of next month this
 * returns nothing until the new offer is recorded, and the form asks instead of carrying today's
 * number forward.
 *
 * `YYYY-MM` compares correctly as a string, which is the whole reason the month is kept in that
 * shape rather than as a `Date`.
 */
export const rateFor = (code: BondSeriesCode, month: OfferMonth): number | undefined => {
  const { until, ranges } = RATES[code];
  if (month > until) return undefined;

  return ranges.find(([from]) => from <= month)?.[1];
};

/** The whole span the catalogue can answer for, oldest month first. */
export const catalogueMonths = (): OfferMonth[] => {
  const first = Object.values(RATES)
    .map(({ ranges }) => ranges.at(-1)![0])
    .reduce((earliest, month) => (month < earliest ? month : earliest));
  const last = Object.values(RATES)
    .map(({ until }) => until)
    .reduce((latest, month) => (month > latest ? month : latest));

  const span = differenceInCalendarMonths(monthStart(last), monthStart(first));

  return Array.from({ length: span + 1 }, (_, index) => format(addMonths(monthStart(first), index), 'yyyy-MM'));
};

/** What was on sale that month, in the order the Ministry lists them: shortest first. */
export const seriesOfferedIn = (month: OfferMonth): BondSeriesSpec[] =>
  BOND_SERIES.filter((series) => rateFor(series.code, month) !== undefined);

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
