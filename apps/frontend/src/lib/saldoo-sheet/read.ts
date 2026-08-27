import type { CsvFormat, RawRow } from '@/lib/banks/contract.ts';
import {
  SHEET_DELIMITER,
  SHEET_ENCODING,
  SHEET_ID,
  sheetConfidence,
  sheetTable,
  type SheetColumn,
} from '@/lib/saldoo-sheet/format.ts';

/**
 * The columns that say something about the payment, as opposed to which record it is.
 *
 * `id` and `delete` are not among them: those two are instructions about the row, and the rest is
 * what the row claims. Keeping them apart is what lets the write path treat "which record" and
 * "what it now says" as two different questions.
 */
export type SheetField = Exclude<SheetColumn, 'id' | 'delete'>;

/**
 * One row of Saldoo's own sheet: which record it names, what it asks for, and what it states.
 *
 * **Nothing is parsed here.** The cells arrive as the file wrote them, and dates, amounts and names
 * are read by the write path — which is the only place that knows whether a badly typed amount is a
 * broken row, an edit to a bank's own figure, or a cell nobody touched on a row being deleted. One
 * reading of the row, one place that decides what to refuse.
 */
export type SheetRow = {
  /** 1-based over the sheet's own table, so it matches the row number Excel prints. */
  row: number;
  /**
   * The record this row names, as the file states it. Empty when somebody typed the row themselves.
   *
   * Read from the file and never minted: a parser that invented an id would be answering the
   * database's question by accident, and the whole point of our own format is that the file gets to
   * answer it instead.
   */
  id?: string;
  /** Whether the delete column holds anything at all. Absence never deletes; a mark does. */
  deleted: boolean;
  /**
   * The cells the file actually has, by column — the value may be an empty string.
   *
   * A column the file does not have is absent from this map, and the difference matters: a deleted
   * column leaves its field alone, while an emptied cell clears it.
   */
  stated: Partial<Record<SheetField, string>>;
};

export type SheetReading = {
  rows: SheetRow[];
  /** Nothing at all, when the file has no header of ours. Distinct from a file of nought rows. */
  recognised: boolean;
};

const cell = (row: RawRow, at: number | undefined): string | undefined =>
  at === undefined ? undefined : String(row[at] ?? '').trim();

/**
 * Saldoo's own sheet, offered on the import screen and recognised by its header like a bank.
 *
 * A `CsvFormat` and deliberately not a `BankCsvParser`: a row of this file can ask for a record to
 * be *deleted*, which is not a payment and cannot be expressed as one. So it carries no `parse`,
 * and the import screen forks to `readSheet` on the strength of its id — the fork is in the write
 * path, exactly where the round trip needs it, and the bank path never learns this file exists.
 */
export const saldooSheetFormat: CsvFormat = {
  id: SHEET_ID,
  // Ours, so it is not translated for the same reason a bank's name is not: it is a name.
  displayName: 'Saldoo',
  version: 1,
  encoding: SHEET_ENCODING,
  delimiter: SHEET_DELIMITER,
  detect: sheetConfidence,
};

/**
 * The rows of one of our own files, as rows rather than as payments.
 *
 * A blank line is skipped rather than reported: every CSV ends with one, and a report that opens by
 * complaining about it is a report people learn to close.
 */
export const readSheet = (rawRows: RawRow[]): SheetReading => {
  const table = sheetTable(rawRows);

  if (!table) return { rows: [], recognised: false };

  const { columns } = table;
  const rows: SheetRow[] = [];

  table.rows.forEach((raw, index) => {
    if (raw.every((value) => String(value ?? '').trim() === '')) return;

    const stated: Partial<Record<SheetField, string>> = {};

    for (const field of ['date', 'description', 'amount', 'currency', 'category', 'goal', 'expense', 'budgetPart'] as SheetField[]) {
      const value = cell(raw, columns[field]);

      if (value !== undefined) stated[field] = value;
    }

    rows.push({
      row: index + 1,
      id: cell(raw, columns.id) || undefined,
      deleted: (cell(raw, columns.delete) ?? '') !== '',
      stated,
    });
  });

  return { rows, recognised: true };
};
