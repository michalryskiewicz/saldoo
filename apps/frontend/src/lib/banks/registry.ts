import type { BankCsvParser, CsvFormat } from '@/lib/banks/contract.ts';
import { ingParser } from '@/lib/banks/ing.ts';
import { pkobpParser } from '@/lib/banks/pkobp.ts';
import { saldooSheetFormat } from '@/lib/saldoo-sheet/read.ts';

/**
 * Every statement format Saldoo can read, in the order the import screen offers them.
 *
 * The one place a bank is added, and the reason the screen above has no list of its own: a select
 * built from a second copy of this is a select that will one day offer a bank nothing can parse.
 */
export const BANK_PARSERS: readonly BankCsvParser[] = [ingParser, pkobpParser];

/**
 * @returns the parser that wrote this `sourceBank`, or nothing when a statement was imported by a
 * parser this build no longer ships — which is a real state, since transactions outlive parsers.
 */
export const parserById = (id: string): BankCsvParser | undefined =>
  BANK_PARSERS.find((parser) => parser.id === id);

/**
 * Everything the import screen can read, whether or not a bank wrote it.
 *
 * Saldoo's own sheet is on this list and not on `BANK_PARSERS`, which is the distinction the two
 * lists exist to keep: it is recognised by its header and offered in the same place as a bank —
 * decision 10 of #141, one gesture for "here is a file with my money in it" — while never being
 * something that can parse a statement into payments.
 */
export const CSV_FORMATS: readonly CsvFormat[] = [...BANK_PARSERS, saldooSheetFormat];
