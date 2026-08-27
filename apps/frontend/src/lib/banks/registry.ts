import type { BankCsvParser } from '@/lib/banks/contract.ts';
import { ingParser } from '@/lib/banks/ing.ts';
import { pkobpParser } from '@/lib/banks/pkobp.ts';

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
