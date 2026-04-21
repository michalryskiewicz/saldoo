export enum CURRENCY {
  'PLN' = 'PLN',
  'USD' = 'USD',
  'EUR' = 'EUR',
}

export type Currency = keyof typeof CURRENCY;
