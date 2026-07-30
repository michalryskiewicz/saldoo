import type { Currency } from '@/constant';
import type { ListExchangeRatesResponseDTO } from '@/store/exchange-rates.api.ts';

type ConvertDataToDesiredCurrencyProps<T extends Record<string, unknown>> = {
  data: T[];
  exchangeRates: ListExchangeRatesResponseDTO | undefined;
  desiredCurrency?: Currency;
  amountKey?: keyof T;
  dateKey?: keyof T;
};

export const convertDataToDesiredCurrency = <T extends Record<string, unknown>>({
  data,
  exchangeRates,
  desiredCurrency,
  amountKey,
  dateKey,
}: ConvertDataToDesiredCurrencyProps<T>): T[] => {
  if (!amountKey || !desiredCurrency) {
    return [];
  }

  // Rates come from a public endpoint that caches NBP data and holds nothing of the
  // user's. Reporting no records when it cannot be reached emptied every list while
  // offline — in an app whose premise is that the local database is the truth.
  // Unconverted and honestly labelled with its own currency beats absent.
  if (!exchangeRates) {
    return data;
  }

  const result: T[] = [];

  for (const item of data) {
    if (item.currency !== desiredCurrency) {
      const effectiveDate = dateKey ? (item[dateKey] as Date) : new Date();

      const convertedAmount = convertMoney({
        amount: item[amountKey] as number,
        toCurrency: desiredCurrency,
        fromCurrency: item.currency as Currency,
        exchangeRates,
        effectiveDate,
      });
      result.push({
        ...item,
        currency: desiredCurrency,
        [amountKey]: Math.round(convertedAmount * 100) / 100,
      });
    } else {
      result.push(item);
    }
  }

  return result;
};

type ConvertMoneyProps = {
  amount: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  exchangeRates: ListExchangeRatesResponseDTO | undefined;
  effectiveDate: Date;
};

export const convertMoney = ({
  amount,
  fromCurrency,
  toCurrency,
  exchangeRates,
  effectiveDate = new Date(),
}: ConvertMoneyProps): number => {
  if (fromCurrency === toCurrency || !exchangeRates || !effectiveDate) return amount;

  // Ensure effectiveDate is always a Date object
  let dateObj: Date;
  if (typeof effectiveDate === 'string') {
    dateObj = new Date(effectiveDate);
  } else {
    dateObj = effectiveDate;
  }
  const dateStr = dateObj.toISOString().split('T')[0];

  // PLN to other currency
  if (fromCurrency === 'PLN') {
    const toRate = exchangeRates[toCurrency]?.[dateStr];
    if (!toRate) {
      console.error('Exchange rate for date not found');
      return amount;
    }
    return amount / toRate;
  }

  // Other currency to PLN
  if (toCurrency === 'PLN') {
    const fromRate = exchangeRates[fromCurrency]?.[dateStr];
    if (!fromRate) {
      console.error('Exchange rate for date not found');
      return amount;
    }
    return amount * fromRate;
  }

  // Other currency to other currency (via PLN)
  const fromRate = exchangeRates[fromCurrency]?.[dateStr];
  const toRate = exchangeRates[toCurrency]?.[dateStr];
  if (!fromRate || !toRate) {
    console.error('Exchange rate for date not found');
    return amount;
  }
  return (amount * fromRate) / toRate;
};
