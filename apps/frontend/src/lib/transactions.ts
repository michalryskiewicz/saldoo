import { ING_HEADER_ROW, ING_STOP_ROWS } from './banks/ing';
import type { ParseStepResult } from 'papaparse';
import { PKOBP_HEADER_ROW, PKOBP_STOP_ROWS } from '@/lib/banks/pkobp.ts';
import { createStepCollector } from '@/lib/banks/step-collector.ts';

type BankSchema = {
  encoding: string;
  delimiter: string;
  step: (step: ParseStepResult<unknown>) => void;
  getRows: () => unknown[][];
};

/** What a statement from each bank looks like: how it is encoded, and where its data starts. */
const BANK_FORMATS: Record<string, { encoding: string; delimiter: string; header: unknown[]; stopRows: unknown[][] }> = {
  ING: {
    encoding: 'cp1250',
    delimiter: ';',
    header: ING_HEADER_ROW,
    stopRows: ING_STOP_ROWS,
  },
  PKOBP: {
    encoding: 'cp1250',
    delimiter: ',',
    header: PKOBP_HEADER_ROW,
    stopRows: PKOBP_STOP_ROWS,
  },
};

/**
 * A reader for one upload, built fresh each time it is asked for.
 *
 * A collector accumulates the rows it has seen, so a shared one carries the previous
 * statement's rows into the next upload of the same session — every row parsed twice, and
 * only the hash check downstream stopping them from being stored twice.
 */
export function getBankSchema(bank: string): BankSchema | undefined {
  const format = BANK_FORMATS[bank];
  if (!format) return undefined;

  const collector = createStepCollector(format.header, format.stopRows);

  return {
    encoding: format.encoding,
    delimiter: format.delimiter,
    step: collector.step,
    getRows: collector.getRows,
  };
}
