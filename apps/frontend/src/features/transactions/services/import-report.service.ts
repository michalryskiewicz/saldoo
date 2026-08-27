import type { ParseWarning } from '@/lib/banks/contract.ts';
import type { SheetRefusal } from '@/features/transactions/services/sheet-plan.service.ts';

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
  /**
   * Rows that changed a record we already held, and records the file asked to remove.
   *
   * Absent on every bank import, because a statement cannot ask for either: it says what happened
   * and has no opinion about our records. Only Saldoo's own sheet (#141) round-trips, so only it
   * ever fills these in — and a report showing "updated: 0" on a bank statement would be answering
   * a question nobody asked.
   */
  updated?: number;
  deleted?: number;
  /**
   * Rows, or single fields of them, that were not applied and why.
   *
   * Beside `unreadable` rather than folded into it, because they are a different kind of refusal:
   * an unreadable row is a row we could not make sense of, while these are rows we understood
   * perfectly and declined — an unknown category, an edit to a figure a bank stated. Calling that
   * "unreadable" would be the report lying about whose fault it is.
   */
  refused?: SheetRefusal[];
  /**
   * How many rows the file offered, where the outcomes cannot be added up to say.
   *
   * Set by our own sheet, whose rows do not fall into one bucket each: a row can be updated and
   * still have a field refused, and a row can be refused outright and land in no bucket at all. The
   * bank path leaves it absent, because there the arithmetic *is* the answer and a second, stated
   * figure is a second thing that can be wrong.
   */
  rows?: number;
};

/**
 * The rows a file offered, however each of them ended up.
 *
 * The buckets it adds up are mutually exclusive, which is what makes it a count of rows rather than
 * of outcomes — so a refusal is not among them. One row of our own sheet can be applied *and* have
 * a field refused, and adding those in would report a file of ten rows as having eleven.
 */
export const rowsSeen = (report: ImportReport): number =>
  report.rows ??
  report.imported +
  report.duplicates +
  report.repeatedInFile +
  report.unreadable.length +
  report.notStored +
  (report.updated ?? 0) +
  (report.deleted ?? 0);

/**
 * Whether this upload needs somebody to look at it rather than just be told it worked.
 *
 * A duplicate is not a problem — it is the expected result of re-uploading a month, and saying so
 * loudly would train people to ignore the report. A row that could not be read or could not be
 * stored is a payment missing from a month, which is the thing worth interrupting for.
 */
export const needsAttention = (report: ImportReport): boolean =>
  report.unreadable.length > 0 || report.notStored > 0 || (report.refused?.length ?? 0) > 0;

/**
 * Whether this report has anything in it beyond a clean import worth offering to save.
 *
 * Asked as its own question because `rowsSeen` cannot answer it: a sheet that updated six rows and
 * imported none has every row accounted for and is still the most interesting report the app
 * produces.
 */
export const worthKeeping = (report: ImportReport): boolean =>
  rowsSeen(report) > report.imported || needsAttention(report);

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

  if (report.updated !== undefined) lines.push(`Updated: ${report.updated}`);
  if (report.deleted !== undefined) lines.push(`Deleted: ${report.deleted}`);

  if (report.from && report.to) lines.push(`Covering: ${report.from} to ${report.to}`);

  if (report.unreadable.length) {
    lines.push(``, `Rows that could not be read:`);
    for (const warning of report.unreadable) lines.push(`  row ${warning.row}: ${warning.reason}`);
  }

  if (report.refused?.length) {
    lines.push(``, `Rows that were not applied:`);
    // The row, the reason and the column — and never the cell. `value` is what somebody called a
    // category, which is theirs, and this is the text that leaves their machine.
    for (const refusal of report.refused)
      lines.push(
        `  row ${refusal.row}: ${refusal.reason}${refusal.field ? ` (${refusal.field})` : ''}`
      );
  }

  return lines.join('\n');
};
