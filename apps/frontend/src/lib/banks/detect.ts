import type { BankCsvParser, RawRow } from '@/lib/banks/contract.ts';

/** One parser's reading of the file, scored on rows read the way that parser writes them. */
export type ScoredParser = {
  parser: BankCsvParser;
  /** 0 to 1, from the parser's own `detect`. */
  confidence: number;
};

export type DetectionCandidate = ScoredParser & { rows: RawRow[] };

/**
 * What the app concluded about an uploaded file, and what it should therefore ask.
 *
 * Three answers rather than a best guess with a score attached, because the three lead to three
 * different screens: get on with it, ask which of these, or admit we do not know this format.
 */
export type Detection =
  /** One parser found its own header intact and nothing else did. Chosen without asking. */
  | { kind: 'certain'; chosen: DetectionCandidate }
  /** More than one could be right, or one is only close. Offered, never assumed. */
  | { kind: 'ambiguous'; options: DetectionCandidate[] }
  /** Nothing recognises it. The universal mapper (#15) is what this hands over to. */
  | { kind: 'unknown' };

/**
 * A header found intact. Nothing weaker may be chosen for somebody: reading a statement with the
 * wrong parser does not fail loudly, it files plausible payments with the wrong columns.
 */
const CERTAIN = 1;

/**
 * Worth offering as a guess. Half a bank's column names on one row is what a bank that renamed or
 * dropped a column looks like — a thing a person can confirm at a glance and the app cannot.
 */
const PLAUSIBLE = 0.5;

const strongestFirst = (a: ScoredParser, b: ScoredParser) =>
  b.confidence - a.confidence || a.parser.id.localeCompare(b.parser.id);

/**
 * Which parser should read this file, or which question to ask about it.
 *
 * Every registered parser scores the file, and each scores it on rows read the way *it* writes
 * them — a semicolon file read as commas is one long cell and would score nought against its own
 * bank. That is why candidates arrive already read rather than as one shared table.
 *
 * Two banks certain at once is not a tie to be broken by ordering: it means two formats really are
 * indistinguishable here, and the person is the only one who knows which bank they exported from.
 */
export const detectParser = (candidates: DetectionCandidate[]): Detection => {
  const ranked = [...candidates].sort(strongestFirst);
  const certain = ranked.filter((candidate) => candidate.confidence >= CERTAIN);

  if (certain.length === 1) return { kind: 'certain', chosen: certain[0] };
  if (certain.length > 1) return { kind: 'ambiguous', options: certain };

  const plausible = ranked.filter((candidate) => candidate.confidence >= PLAUSIBLE);

  return plausible.length ? { kind: 'ambiguous', options: plausible } : { kind: 'unknown' };
};
