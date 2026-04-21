import { createStepCollector } from '@/lib/banks/step-collector.ts';

export const PKOBP_HEADER_ROW = [
  'Data operacji',
  'Data waluty',
  'Typ transakcji',
  'Kwota',
  'Waluta',
  'Opis transakcji',
  '',
  '',
  '',
  '',
  '',
];

export const PKOBP_STOP_ROWS = [['']];

export const pkobpStepCollector = createStepCollector(PKOBP_HEADER_ROW, PKOBP_STOP_ROWS);
