import { ingStepCollector } from './banks/ing';
import type { ParseStepResult } from 'papaparse';
import { pkobpStepCollector } from '@/lib/banks/pkobp.ts';

type BankSchema = {
  encoding: string;
  delimiter: string;
  step: (step: ParseStepResult<unknown>) => void;
  getRows: () => unknown[][];
};

export function getBankSchema(bank: string): BankSchema | undefined {
  return bankSchemas[bank];
}

const bankSchemas: Record<string, BankSchema> = {
  ING: {
    encoding: 'cp1250',
    delimiter: ';',
    step: ingStepCollector.step,
    getRows: ingStepCollector.getRows,
  },
  PKOBP: {
    encoding: 'cp1250',
    delimiter: ',',
    step: pkobpStepCollector.step,
    getRows: pkobpStepCollector.getRows,
  },
};
