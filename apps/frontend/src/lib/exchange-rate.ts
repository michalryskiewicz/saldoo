import type { Currency } from '@/constant';
import type { ListExchangeRatesResponseDTO } from '@/store/exchange-rates.api.ts';

type ConvertDataToDesiredCurrencyProps<T extends Record<string, unknown>> = {
  data: T[];
  exchangeRates: ListExchangeRatesResponseDTO | undefined;
  desiredCurrency?: Currency;
  amountKey?: keyof T;
  dateKey?: keyof T;
};

/**
 * What a converted figure was before it was converted.
 *
 * Present only where a conversion actually happened, which makes its presence the answer to "is
 * this the number somebody entered, or one this app worked out?" — a question a table cannot answer
 * from the figure alone, and the reader cannot check.
 */
export type ConvertedFrom = { amount: number; currency: Currency };

/** A record as it comes back from the converter: the same shape, plus how it got here if it moved. */
export type MaybeConverted<T> = T & { convertedFrom?: ConvertedFrom };

export const convertDataToDesiredCurrency = <T extends Record<string, unknown>>({
  data,
  exchangeRates,
  desiredCurrency,
  amountKey,
  dateKey,
}: ConvertDataToDesiredCurrencyProps<T>): MaybeConverted<T>[] => {
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

  const result: MaybeConverted<T>[] = [];

  for (const item of data) {
    if (item.currency === desiredCurrency) {
      result.push(item);
      continue;
    }

    const rate = rateBetween({
      toCurrency: desiredCurrency,
      fromCurrency: item.currency as Currency,
      exchangeRates,
      effectiveDate: dateKey ? (item[dateKey] as Date) : new Date(),
    });

    // The figure and the sign over it are the same money or the record does not move. Relabelling
    // an amount nobody could convert is worse than leaving it alone: it is wrong by the whole rate
    // and says nothing about being wrong, whereas its own currency at least reads true.
    if (rate === undefined) {
      result.push(item);
      continue;
    }

    result.push({
      ...item,
      currency: desiredCurrency,
      [amountKey]: Math.round((item[amountKey] as number) * rate * 100) / 100,
      // Travels with the figure so a table can say the number was worked out rather than entered.
      // Only ever set here — on the one path where a conversion really happened.
      convertedFrom: {
        amount: item[amountKey] as number,
        currency: item.currency as Currency,
      } satisfies ConvertedFrom,
    });
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

/**
 * The rate that stood on a day — which is the last one published on or before it.
 *
 * A rate is published on business days, so most weeks hold two days it says nothing about and a
 * bank holiday adds more. Those are ordinary days on which money still moves: a bond is priced on
 * a Sunday, a duty falls on a Saturday, a projection asks about next March. Reading the day itself
 * and giving up where it is empty is what put a złoty figure under a euro sign.
 *
 * Carried forward, never interpolated. Friday's rate is the rate that stood all weekend; there is
 * no truer figure hiding between two published ones, and inventing one would move a total for a
 * reason that never happened.
 */
const rateOn = (
  published: Record<string, number | null> | undefined,
  day: string
): number | undefined => {
  if (!published) return undefined;

  const onTheDay = published[day];
  if (typeof onTheDay === 'number') return onTheDay;

  const lastPublishedBefore = Object.keys(published)
    .filter((date) => date <= day && typeof published[date] === 'number')
    .sort()
    .pop();

  return lastPublishedBefore ? (published[lastPublishedBefore] as number) : undefined;
};

/**
 * What one currency multiplies by to become the other on a day — or nothing, where no rate stood.
 *
 * The absence is the point. A caller that only gets a number back cannot tell a converted figure
 * from an unconvertible one, and the app spent that ambiguity printing złoty under a euro sign.
 */
export const rateBetween = ({
  fromCurrency,
  toCurrency,
  exchangeRates,
  effectiveDate,
}: Omit<ConvertMoneyProps, 'amount'>): number | undefined => {
  if (fromCurrency === toCurrency) return 1;
  if (!exchangeRates || !effectiveDate) return undefined;

  const day = new Date(effectiveDate).toISOString().split('T')[0];

  if (fromCurrency === 'PLN') {
    const toRate = rateOn(exchangeRates[toCurrency], day);

    return toRate ? 1 / toRate : undefined;
  }

  if (toCurrency === 'PLN') {
    return rateOn(exchangeRates[fromCurrency], day) ?? undefined;
  }

  // Neither is the currency rates are published against, so it takes both and goes through it.
  const fromRate = rateOn(exchangeRates[fromCurrency], day);
  const toRate = rateOn(exchangeRates[toCurrency], day);

  return fromRate && toRate ? fromRate / toRate : undefined;
};

export const convertMoney = ({ amount, ...on }: ConvertMoneyProps): number => {
  // No day means nobody knows when this money is from, and a rate is only true of a day. Standing
  // in today's date for it would be a guess wearing the clothes of a fact — now that the lookup
  // carries the last published rate forward, that guess would always find something to convert at.
  if (on.fromCurrency === on.toCurrency || !on.exchangeRates || !on.effectiveDate) return amount;

  const rate = rateBetween(on);

  if (rate === undefined) {
    console.error('Exchange rate for date not found');
    return amount;
  }

  return amount * rate;
};
