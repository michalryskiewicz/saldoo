import { STRATEGY_PART } from '@/constant.ts';
import type { Locale } from '@/i18n.ts';
import type { RawRow } from '@/lib/banks/contract.ts';

/**
 * Saldoo's own spreadsheet format: what its columns are, and every spelling of them we accept.
 *
 * **The format lives here and not in `i18n`.** A header is not copy. Translations get edited for
 * tone, and an edit to a translation must never be able to make last year's export unreadable — so
 * the labels are written down once, in code, and `i18n` is left to the words on the buttons.
 *
 * Both languages are in the table at once because that is the round trip decision 9 asks for: the
 * export writes headers in the language the app is in, and the import matches against every
 * language, so somebody who switches the app to English is not locked out of their Polish files.
 */

/** The id every Saldoo transaction imported through this format carries as its `sourceBank`. */
export const SHEET_ID = 'saldoo-sheet';

/**
 * UTF-8 with a byte order mark, semicolon-separated — what Polish Excel opens on a double click.
 *
 * Without the mark Excel reads a UTF-8 file as the local code page and turns every `ł` into
 * mojibake; with a comma delimiter it puts the whole row in one cell. Sheets takes this as-is.
 */
export const SHEET_ENCODING = 'utf-8';
export const SHEET_DELIMITER = ';';
export const BYTE_ORDER_MARK = '﻿';

/** Every column of the format, in the order the file writes them. */
export const SHEET_COLUMNS = [
  'id',
  'date',
  'description',
  'amount',
  'currency',
  'category',
  'goal',
  'expense',
  'budgetPart',
  'delete',
] as const;

export type SheetColumn = (typeof SHEET_COLUMNS)[number];

/**
 * The columns without which a file is not one of ours.
 *
 * `id` is the one that matters: it is what makes a re-import an edit rather than a second copy, and
 * no bank prints a column of our uuids. A file missing any of these is somebody else's file.
 */
const REQUIRED_COLUMNS: readonly SheetColumn[] = ['id', 'date', 'description', 'amount'];

const LABELS: Record<Locale, Record<SheetColumn, string>> = {
  pl: {
    id: 'id',
    date: 'data',
    description: 'opis',
    amount: 'kwota',
    currency: 'waluta',
    category: 'kategoria',
    goal: 'cel',
    expense: 'koszt',
    budgetPart: 'część budżetu',
    delete: 'usuń',
  },
  en: {
    id: 'id',
    date: 'date',
    description: 'description',
    amount: 'amount',
    currency: 'currency',
    category: 'category',
    goal: 'goal',
    expense: 'expense',
    budgetPart: 'budget part',
    delete: 'delete',
  },
};

/** The header row this export writes, in the language the app is currently in. */
export const sheetHeader = (locale: Locale): string[] =>
  SHEET_COLUMNS.map((column) => LABELS[locale][column]);

/**
 * What a column is called, for naming a refusal by the column somebody actually edited.
 *
 * The header label rather than a phrase of its own, because the person is looking at the file: told
 * that something is wrong with `kwota`, they know which cell to open.
 */
export const sheetColumnLabel = (column: SheetColumn, locale: Locale): string =>
  LABELS[locale][column];

/**
 * A cell as it is compared, not as it was typed.
 *
 * Case, padding, the byte order mark and Polish diacritics are all things a spreadsheet or a person
 * changes without meaning to change what the cell says. `część budżetu` and `Czesc budzetu` are the
 * same column, and a file that came back through a tool which stripped the accents still imports.
 *
 * The same rule matches a category, goal or cost by name, and being blind to diacritics there is
 * deliberately safe rather than clever: two categories that differ only by an accent collide under
 * this, and a collision is *reported as ambiguous* instead of one of them being picked. Guessing
 * between somebody's two categories is the one outcome worth refusing.
 */
export const normaliseCell = (value: unknown): string =>
  String(value ?? '')
    .replace(BYTE_ORDER_MARK, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');

const ALIASES: Record<string, SheetColumn> = Object.fromEntries(
  SHEET_COLUMNS.flatMap((column) =>
    (Object.keys(LABELS) as Locale[]).map((locale) => [normaliseCell(LABELS[locale][column]), column])
  )
);

/**
 * Which cell of this row holds which column, for the columns it names at all.
 *
 * A column the row does not name is absent from the result, and that absence is load-bearing
 * downstream: a column missing from the file leaves that field alone, while a column present with
 * an empty cell clears it. Deleting a whole column in Excel is not the same gesture as clearing
 * one cell, and reading both as "no change" would ignore an edit somebody plainly made.
 */
export const resolveColumns = (row: RawRow): Partial<Record<SheetColumn, number>> => {
  const columns: Partial<Record<SheetColumn, number>> = {};

  row.forEach((cell, index) => {
    const column = ALIASES[normaliseCell(cell)];

    // First occurrence wins: a file with two columns called "opis" is one we can still read, and
    // the alternative is refusing the whole import over a duplicated header.
    if (column && columns[column] === undefined) columns[column] = index;
  });

  return columns;
};

const namesEveryRequiredColumn = (columns: Partial<Record<SheetColumn, number>>) =>
  REQUIRED_COLUMNS.every((column) => columns[column] !== undefined);

/**
 * How sure we are this is a file Saldoo wrote: one, or nothing.
 *
 * Deliberately binary where a bank's score is a gradient. A bank's header drifts because the bank
 * changes it and we find out afterwards; ours does not drift, because we write it. So there is no
 * such thing as a file that half looks like ours and is worth guessing at — either the header is
 * there, or this is not the format and reading it as one would file somebody's whole month wrong.
 */
export const sheetConfidence = (rawRows: RawRow[]): number =>
  rawRows.some((row) => namesEveryRequiredColumn(resolveColumns(row))) ? 1 : 0;

/** Where this file's table starts, and what its columns mean. */
export type SheetTable = {
  columns: Partial<Record<SheetColumn, number>>;
  /** The rows under the header, in file order. */
  rows: RawRow[];
};

/**
 * The header, and everything below it.
 *
 * Our own file has no preamble and no footer — unlike a bank statement, which is why this needs
 * nothing as careful as `statementRows`. The header is looked for rather than assumed to be line
 * one all the same: Sheets and Excel both let somebody leave a note above the table.
 */
export const sheetTable = (rawRows: RawRow[]): SheetTable | undefined => {
  for (const [index, row] of rawRows.entries()) {
    const columns = resolveColumns(row);

    if (namesEveryRequiredColumn(columns)) return { columns, rows: rawRows.slice(index + 1) };
  }

  return undefined;
};

/**
 * What each part of a budgeting strategy is called in the file.
 *
 * Written out rather than read from `i18n` for the same reason the headers are: this is format. It
 * happens to match the copy today, and if the copy is ever reworded, files written before the
 * rewording still import — which is the whole point of an alias table.
 */
const BUDGET_PART_LABELS: Record<Locale, Record<STRATEGY_PART, string>> = {
  pl: {
    [STRATEGY_PART.NEEDS]: 'Potrzeby',
    [STRATEGY_PART.WANTS]: 'Zachcianki',
    [STRATEGY_PART.SAVINGS]: 'Oszczędności',
    [STRATEGY_PART.DEBTS]: 'Długi',
    [STRATEGY_PART.NEEDS_AND_WANTS]: 'Potrzeby i Zachcianki',
    [STRATEGY_PART.SHORT_TERM_SAVINGS]: 'Krótko Okresowe Oszczędności',
    [STRATEGY_PART.LONG_TERM_SAVINGS]: 'Długo Okresowe Oszczędności',
  },
  en: {
    [STRATEGY_PART.NEEDS]: 'Needs',
    [STRATEGY_PART.WANTS]: 'Wants',
    [STRATEGY_PART.SAVINGS]: 'Savings',
    [STRATEGY_PART.DEBTS]: 'Debts',
    [STRATEGY_PART.NEEDS_AND_WANTS]: 'Needs and wants',
    [STRATEGY_PART.SHORT_TERM_SAVINGS]: 'Short-term savings',
    [STRATEGY_PART.LONG_TERM_SAVINGS]: 'Long-term savings',
  },
};

export const budgetPartLabel = (part: STRATEGY_PART, locale: Locale): string =>
  BUDGET_PART_LABELS[locale][part];

const BUDGET_PART_ALIASES: Record<string, STRATEGY_PART> = Object.fromEntries(
  Object.values(STRATEGY_PART).flatMap((part) => [
    // The enum's own name is accepted too, so a file written by hand or by a script is readable
    // without anybody having to know which words the app prints.
    [normaliseCell(part), part],
    ...(Object.keys(BUDGET_PART_LABELS) as Locale[]).map((locale) => [
      normaliseCell(BUDGET_PART_LABELS[locale][part]),
      part,
    ]),
  ])
);

/** @returns nothing when the cell says something no strategy has a part for, so it can be reported. */
export const budgetPartFrom = (value: string): STRATEGY_PART | undefined =>
  BUDGET_PART_ALIASES[normaliseCell(value)];
