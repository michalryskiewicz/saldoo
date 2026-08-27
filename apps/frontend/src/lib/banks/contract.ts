import type { Currency } from '@/constant.ts';

/** One line of a statement as the CSV reader hands it over: cells, in file order, untouched. */
export type RawRow = unknown[];

/**
 * A payment as every bank agrees it happened, whatever their column order calls it.
 *
 * Deliberately smaller than `DBTransaction`: no id, no `createdAt`, no hash. A parser reads a file
 * and says what is in it — deciding what is *new* is the database's question, asked once for every
 * bank rather than once per parser, and a parser that minted ids would be answering it by accident.
 *
 * `rawData` is kept because the hash that de-duplicates an import is taken over the original row.
 * Dropping it would change what "the same payment" means and re-import every statement anybody has
 * already loaded.
 */
export type ParsedTransaction = {
  /** As the file states it, not as a `Date`: a statement's own day is the fact, timezones are ours. */
  transactionDate: string;
  description: string;
  amount: number;
  currency: Currency | '';
  /** The bank's own reference, where it prints one. ING does; PKO BP does not. */
  transactionId?: string;
  rawData: RawRow;
};

/**
 * A row the parser could not turn into a payment, and why.
 *
 * Named by the line it came from rather than by its content: "row 41" is what somebody can find in
 * the file they just uploaded, and the content may be exactly what they must not have pasted to us.
 */
export type ParseWarning = {
  /** 1-based, counted over the rows of the statement's own table, so it matches what a person counts. */
  row: number;
  reason: 'unreadable-amount' | 'no-date';
};

export type ParseResult = {
  transactions: ParsedTransaction[];
  warnings: ParseWarning[];
};

/**
 * Enough to recognise a file and read it: who this format is, and how sure it is the file is its own.
 *
 * Separated from `BankCsvParser` because reading a file and turning its rows into payments are not
 * the same job, and one format Saldoo ships does only the first: its own sheet (#141) states which
 * record each row *is* and whether it should be deleted, which no `ParsedTransaction` can carry and
 * no bank ever says. Detection and the file read work on this, so that sheet can be offered on the
 * import screen and recognised by its header exactly like a bank, without pretending to be one.
 */
export type CsvFormat = {
  /** Stable, stored on every transaction as `sourceBank`. Renaming one orphans somebody's history. */
  id: string;
  /** What the format calls itself, for the screen. Not translated: a bank's name is its name. */
  displayName: string;
  /**
   * Bumped when this format's reading changes in a way that would produce different records from
   * the same file. Recorded with the import so a later fix can find what it broke.
   */
  version: number;
  /** How the file is written, which is not negotiable and not detectable before reading it. */
  encoding: string;
  delimiter: string;
  /**
   * How sure this format is that the file is its own, from 0 to 1.
   *
   * A number rather than a yes: two banks can export something similar enough that only the caller,
   * seeing every score at once, can say whether one of them stands out. What counts as sure enough
   * is the caller's rule, not each format's.
   */
  detect: (rawRows: RawRow[]) => number;
};

/**
 * What Saldoo knows about one bank's statement export.
 *
 * The point of the contract is that everything bank-shaped lives behind it: the import screen picks
 * a parser and hands it a file, and nothing above this line knows that ING writes `;` and cp1250,
 * that its table starts under a nineteen-column header, or that its amounts use a comma. Adding a
 * bank is adding a file in this folder and a line in the registry.
 *
 * `detect` is here rather than in the autodetect feature (#14) because the knowledge it needs is the
 * same knowledge `parse` needs, and split across two modules the two would drift: a parser that had
 * learned a second header layout would go on being detected by the first.
 */
export type BankCsvParser = CsvFormat & {
  parse: (rawRows: RawRow[]) => ParseResult;
};
