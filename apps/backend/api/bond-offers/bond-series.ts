/**
 * The retail series as the Ministry's own site addresses them.
 *
 * Kept apart from the service on purpose: this is a table and two pure functions, and importing it
 * must not drag a database client along — the address builder is the part worth trying against the
 * live site before trusting a weekly job to it.
 */
export type BondSeriesCode = 'ROR' | 'DOR' | 'TOS' | 'COI' | 'ROS' | 'EDO' | 'ROD';

/**
 * Where each series lives on the Ministry's site, and how long it runs.
 *
 * The tenor is here for one reason: an issue is named for the month it is **redeemed**, so the
 * address of what was sold in August 2026 is built by adding the tenor to that month. The frontend
 * knows the same thing for its own reasons; duplicating seven numbers across two apps is cheaper
 * than a shared package for seven numbers, and both are pinned by tests against published names.
 */
export const SERIES: Record<BondSeriesCode, { path: string; tenorMonths: number }> = {
  ROR: { path: 'obligacje-roczne-ror', tenorMonths: 12 },
  DOR: { path: 'obligacje-2-letnie-dor', tenorMonths: 24 },
  TOS: { path: 'obligacje-3-letnie-tos', tenorMonths: 36 },
  COI: { path: 'obligacje-4-letnie-coi', tenorMonths: 48 },
  ROS: { path: 'obligacje-6-letnie-ros', tenorMonths: 72 },
  EDO: { path: 'obligacje-10-letnie-edo', tenorMonths: 120 },
  ROD: { path: 'obligacje-12-letnie-rod', tenorMonths: 144 },
};

const BASE = 'https://www.obligacjeskarbowe.pl/oferta-obligacji';

const redemptionCode = (code: BondSeriesCode, month: string): string => {
  const [year, index] = month.split('-').map(Number);
  const redeemed = new Date(year, index - 1 + SERIES[code].tenorMonths, 1);

  return `${code}${String(redeemed.getMonth() + 1).padStart(2, '0')}${String(redeemed.getFullYear()).slice(-2)}`;
};

/** The page for what a series sold in a given month. */
export const issueUrl = (code: BondSeriesCode, month: string): string =>
  `${BASE}/${SERIES[code].path}/${redemptionCode(code, month).toLowerCase()}/`;
