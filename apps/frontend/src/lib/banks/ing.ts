import { createStepCollector } from './step-collector.ts';

export const ING_HEADER_ROW = [
  'Data transakcji',
  'Data księgowania',
  'Dane kontrahenta',
  'Tytuł',
  'Nr rachunku',
  'Nazwa banku',
  'Szczegóły',
  'Nr transakcji',
  'Kwota transakcji (waluta rachunku)',
  'Waluta',
  'Kwota blokady/zwolnienie blokady',
  'Waluta',
  'Kwota płatności w walucie',
  'Waluta',
  'Konto',
  'Bank',
  'Saldo po transakcji',
  'Waluta',
  '',
  '',
  '',
];

export const ING_STOP_ROWS = [
  [''],
  ['Dokument ma charakter informacyjny, nie stanowi dowodu księgowego', ''],
];

export const ingStepCollector = createStepCollector(ING_HEADER_ROW, ING_STOP_ROWS);
