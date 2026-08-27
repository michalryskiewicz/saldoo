import type { ParseWarning } from '@/lib/banks/contract.ts';

/**
 * What one upload did, in full.
 *
 * Every number here answers a question somebody actually asks after importing: did it work, why is
 * it fewer rows than the file has, and is this the month I meant to load. "Imported 132" alone
 * answers none of them, and a statement is exactly the kind of thing where a quiet miscount is
 * discovered a quarter later.
 */
export type ImportReport = {
  /** Payments stored by this upload. */
  imported: number;
  /** Rows the app already held, by hash — the whole reason re-uploading a month is safe. */
  duplicates: number;
  /** Rows repeated inside this one file, which a bank does export and which are not new either. */
  repeatedInFile: number;
  /** Rows the parser could not read, kept as reasons so the report can name them one by one. */
  unreadable: ParseWarning[];
  /** Rows that were read and then failed to store. Nought is the only acceptable number. */
  notStored: number;
  /** The span the stored payments cover, absent when nothing was stored. */
  from?: string;
  to?: string;
};

/** The rows a file offered, however each of them ended up. */
export const rowsSeen = (report: ImportReport): number =>
  report.imported + report.duplicates + report.repeatedInFile + report.unreadable.length + report.notStored;

/**
 * Whether this upload needs somebody to look at it rather than just be told it worked.
 *
 * A duplicate is not a problem — it is the expected result of re-uploading a month, and saying so
 * loudly would train people to ignore the report. A row that could not be read or could not be
 * stored is a payment missing from a month, which is the thing worth interrupting for.
 */
export const needsAttention = (report: ImportReport): boolean =>
  report.unreadable.length > 0 || report.notStored > 0;

const dateRange = (dates: string[]): Pick<ImportReport, 'from' | 'to'> => {
  const sorted = [...dates].filter(Boolean).sort();

  return sorted.length ? { from: sorted[0], to: sorted[sorted.length - 1] } : {};
};

export const reportOf = (
  parts: Omit<ImportReport, 'from' | 'to'> & { storedDates: string[] }
): ImportReport => {
  const { storedDates, ...counts } = parts;

  return { ...counts, ...dateRange(storedDates) };
};

/**
 * The report as text somebody can paste into an email to us, or keep.
 *
 * Plain text rather than JSON: the person who needs it is the one whose statement did not import
 * cleanly, and what they need to send is something they can read first. It names rows and reasons
 * and never a description or an amount — a report about somebody's money should be safe to send.
 */
export const reportAsText = (
  report: ImportReport,
  { bank, fileName }: { bank: string; fileName: string }
): string => {
  const lines = [
    `Saldoo — import report`,
    `File: ${fileName}`,
    `Format: ${bank}`,
    ``,
    `Rows in file: ${rowsSeen(report)}`,
    `Imported: ${report.imported}`,
    `Already held: ${report.duplicates}`,
    `Repeated in the file: ${report.repeatedInFile}`,
    `Unreadable: ${report.unreadable.length}`,
    `Read but not stored: ${report.notStored}`,
  ];

  if (report.from && report.to) lines.push(`Covering: ${report.from} to ${report.to}`);

  if (report.unreadable.length) {
    lines.push(``, `Rows that could not be read:`);
    for (const warning of report.unreadable) lines.push(`  row ${warning.row}: ${warning.reason}`);
  }

  return lines.join('\n');
};
