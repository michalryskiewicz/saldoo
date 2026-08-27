import Papa from 'papaparse';
import type { CsvFormat, RawRow } from '@/lib/banks/contract.ts';
import type { DetectionCandidate } from '@/lib/banks/detect.ts';

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
  { encoding, delimiter }: Pick<CsvFormat, 'encoding' | 'delimiter'>
): Promise<RawRow[]> =>
  new Promise((resolve, reject) => {
    Papa.parse(file as File, {
      encoding,
      delimiter,
      complete: (results) => resolve(results.data as RawRow[]),
      error: (error: unknown) => reject(error instanceof Error ? error : new Error(String(error))),
    });
  });

/**
 * Every parser's reading of one upload, each scored on rows read the way that parser writes them.
 *
 * A file read with the wrong delimiter is one enormous cell, and would score nought against the very
 * bank that wrote it — so this cannot be one read shared by all of them. It is not one read per
 * parser either: banks that agree on encoding and delimiter share the read, which today is both of
 * them and one pass over the file.
 *
 * The rows are handed back with the scores because the import that follows needs exactly these rows.
 * Reading the file a second time to parse what we have already read would be the kind of waste that
 * only shows up on somebody's four-thousand-row annual statement.
 */
export const readCandidates = async (
  file: File | string,
  parsers: readonly CsvFormat[]
): Promise<DetectionCandidate[]> => {
  const byFormat = new Map<string, CsvFormat[]>();

  for (const parser of parsers) {
    const format = `${parser.encoding}|${parser.delimiter}`;
    byFormat.set(format, [...(byFormat.get(format) ?? []), parser]);
  }

  const candidates: DetectionCandidate[] = [];

  for (const sharingAFormat of byFormat.values()) {
    const rows = await readStatement(file, sharingAFormat[0]);

    for (const parser of sharingAFormat) {
      candidates.push({ parser, confidence: parser.detect(rows), rows });
    }
  }

  return candidates;
};
