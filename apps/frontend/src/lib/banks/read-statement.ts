import Papa from 'papaparse';
import type { BankCsvParser, RawRow } from '@/lib/banks/contract.ts';

/**
 * A statement file as rows, read the way the bank that wrote it says to.
 *
 * **On this thread rather than in a worker.** Papa spawns its worker from a `blob:` URL, and the
 * shipped Content-Security-Policy refuses it — `worker-src` is unset, so `script-src 'self'` is what
 * it falls back to. The upload then died in silence: no rows stored, and no error shown either,
 * because the `complete` that reports both never ran. A bank statement is a few thousand rows; the
 * thread it parses on was never worth an exception in a policy this app's whole claim rests on.
 *
 * The whole file is read before anything is parsed, because that is what detection needs: which
 * bank wrote this cannot be answered from a row at a time.
 */
export const readStatement = (
  file: File | string,
  { encoding, delimiter }: Pick<BankCsvParser, 'encoding' | 'delimiter'>
): Promise<RawRow[]> =>
  new Promise((resolve, reject) => {
    Papa.parse(file as File, {
      encoding,
      delimiter,
      complete: (results) => resolve(results.data as RawRow[]),
      error: (error: unknown) => reject(error instanceof Error ? error : new Error(String(error))),
    });
  });
