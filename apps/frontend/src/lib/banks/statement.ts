import type { RawRow } from '@/lib/banks/contract.ts';

/**
 * The same values in both rows, whatever their order and however often each repeats.
 *
 * What a bank's footer row is recognised by, and set semantics is what it has always used — a
 * two-cell `['', '']` and a one-cell `['']` are the same end-of-statement marker. Written out
 * rather than borrowed from a utility library so that describing a statement's format costs
 * nothing but the format: this module used to reach `lodash` for it, which put a CommonJS bundle
 * in the import graph of every file that names a column.
 */
const sameValues = (a: unknown[], b: unknown[]) => {
  const left = new Set(a);
  const right = new Set(b);

  return left.size === right.size && [...left].every((value) => right.has(value));
};

/** Trailing columns vary between exports of the same bank, so the header is matched as a prefix. */
const startsWith = (row: RawRow, expected: RawRow) =>
  row.length >= expected.length && expected.every((cell, index) => row[index] === cell);

/**
 * The rows of the statement's own table: what sits between the header and whatever ends it.
 *
 * A statement is not a CSV file with a header on line one. It opens with a preamble about the
 * account, prints its table somewhere in the middle, and closes with a note that the document
 * proves nothing — all of it comma-separated and none of it transactions.
 *
 * A pure function over rows that have already been read, where this used to be a streaming
 * callback that accumulated into itself. The streaming bought nothing — the rows were kept in
 * memory either way — and cost the thing every caller got wrong: a collector reused across two
 * uploads carried the first statement's rows into the second.
 */
export const statementRows = (rawRows: RawRow[], header: RawRow, stopRows: RawRow[]): RawRow[] => {
  const rows: RawRow[] = [];
  let collecting = false;

  for (const row of rawRows) {
    if (startsWith(row, header)) {
      collecting = true;
      continue;
    }

    if (stopRows.some((stopRow) => sameValues(row, stopRow))) {
      collecting = false;
      continue;
    }

    if (collecting) rows.push(row);
  }

  return rows;
};

/**
 * How much this file looks like it was written by the bank that prints this header, from 0 to 1.
 *
 * The header found intact is the whole answer, and 1 says so. Below that the score is the share of
 * the header's own labels that turn up on some single row, which is what a bank changing one column
 * looks like — enough to be offered as a guess, never enough to be chosen without asking.
 *
 * Blank labels are dropped before scoring: several banks pad their header with empty cells, and a
 * file of empty rows would otherwise score well against all of them.
 */
export const headerConfidence = (rawRows: RawRow[], header: RawRow): number => {
  const labels = header.filter((cell) => typeof cell === 'string' && cell.trim() !== '');
  if (!labels.length) return 0;

  let best = 0;

  for (const row of rawRows) {
    if (startsWith(row, header)) return 1;

    const cells = new Set(row);
    const found = labels.filter((label) => cells.has(label)).length;

    best = Math.max(best, found / labels.length);
  }

  return best;
};

/**
 * A figure as a bank writes it, or nothing at all.
 *
 * Polish exports write `-1 234,56`, and the space is as likely to be a non-breaking one as a plain
 * one. `parseFloat` reads that as -1, which is the failure mode worth the most care here: it is
 * silent, it is plausible, and it is out by a factor of a thousand.
 *
 * Nothing rather than nought when the cell cannot be read, so the caller can say which row it could
 * not read instead of importing a payment of zero that nobody made.
 */
export const parseAmount = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;

  const cleaned = value.replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (cleaned === '') return undefined;

  const amount = Number(cleaned);

  return Number.isFinite(amount) ? amount : undefined;
};
