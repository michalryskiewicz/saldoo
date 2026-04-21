import prisma from '../../prisma/prisma.ts';
import { EXTERNAL_URL } from '../../config/constant.ts';
import Cache from '../../utils/cache.ts';
import { getDay, subDays } from 'date-fns';
import { formatDateISO, getEffectiveDateForCurrency } from '../../utils';
import { type Currency, CURRENCY } from '../../utils/types.ts';
import { eachDayOfInterval } from 'date-fns';

export const getExchangeRatesForDateRange = async (
  fromCurrency: Currency,
  toCurrency: Currency,
  fromDate: Date,
  toDate: Date,
): Promise<{ date: string; rate: number | null }[]> => {
  const dates = eachDayOfInterval({ start: fromDate, end: toDate });
  const results: { date: string; rate: number | null }[] = [];

  for (const date of dates) {
    let queryDate = date;
    const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday

    if (dayOfWeek === 6) {
      // Saturday
      queryDate = subDays(date, 1); // Friday
    } else if (dayOfWeek === 0) {
      // Sunday
      queryDate = subDays(date, 2); // Friday
    }

    const rate = await convertMoney(1, fromCurrency, toCurrency, queryDate);
    const dateToResult = formatDateISO(date);
    results.push({ date: dateToResult, rate });
  }

  return results;
};

export const convertMoney = async (
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  effectiveDate: Date = new Date(),
): Promise<number> => {
  if (fromCurrency === toCurrency) return amount;

  const effectiveDateISO = getEffectiveDateForCurrency(effectiveDate);

  let midExchangeRate = await Cache.get<number | null>(
    `${fromCurrency}-${toCurrency}-${effectiveDateISO}`,
  );

  if (!midExchangeRate || midExchangeRate < 0) {
    midExchangeRate = await getMidExchangeRate(
      fromCurrency,
      toCurrency,
      effectiveDateISO,
    );

    await Cache.set(
      `${fromCurrency}-${toCurrency}-${effectiveDateISO}`,
      midExchangeRate,
    );
  }

  if (!midExchangeRate) {
    console.error('MID Exchange rate mismatch');
    return -1;
  }

  return midExchangeRate * amount;
};

const getMidExchangeRate = async (
  fromCurrency: Currency,
  toCurrency: Currency,
  effectiveDate: string,
): Promise<number | null> => {
  if (fromCurrency === toCurrency) return 1;

  const effectiveDateObj = new Date(effectiveDate);

  // Direct rate: fromCurrency to PLN
  if (toCurrency === CURRENCY.PLN) {
    const data = await prisma.exchangeRate.findFirst({
      where: { fromCurrency, toCurrency, effectiveDate: effectiveDateObj },
    });
    if (data && typeof data.mid === 'number') return data.mid;

    // Fetch from API if not found
    const mid = await fetchMidPLNExchangeRateFromAPI(
      fromCurrency,
      effectiveDate,
    );
    if (typeof mid === 'number') {
      await prisma.exchangeRate.create({
        data: {
          fromCurrency,
          toCurrency,
          effectiveDate: effectiveDateObj,
          mid,
        },
      });
      return mid;
    }
    return null;
  }

  // Inverse rate: PLN to toCurrency
  if (fromCurrency === CURRENCY.PLN) {
    const data = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: toCurrency,
        toCurrency: CURRENCY.PLN,
        effectiveDate: effectiveDateObj,
      },
    });
    if (data && typeof data.mid === 'number') return 1 / data.mid;

    // Fetch from API if not found
    const mid = await fetchMidPLNExchangeRateFromAPI(toCurrency, effectiveDate);
    if (typeof mid === 'number') {
      await prisma.exchangeRate.create({
        data: {
          fromCurrency: toCurrency,
          toCurrency: CURRENCY.PLN,
          effectiveDate: effectiveDateObj,
          mid,
        },
      });
      return 1 / mid;
    }
    return null;
  }

  // Neither is PLN: use PLN as bridge
  const fromToPLN = await getMidExchangeRate(
    fromCurrency,
    CURRENCY.PLN,
    effectiveDate,
  );
  const toToPLN = await getMidExchangeRate(
    toCurrency,
    CURRENCY.PLN,
    effectiveDate,
  );
  if (fromToPLN && toToPLN) return fromToPLN / toToPLN;

  return null;
};

const fetchMidPLNExchangeRateFromAPI = async (
  toCurrency: Omit<Currency, 'PLN'>,
  effectiveDate: Date | string,
): Promise<number | Error> => {
  try {
    let date =
      typeof effectiveDate === 'string'
        ? new Date(effectiveDate)
        : effectiveDate;

    if (date.getFullYear() < 2010) {
      throw new Error("Date Before 2010. We're not gonna handle that!");
    }

    let attempts = 0;
    const maxAttempts = 7; // Try up to a week back

    while (attempts < maxAttempts) {
      const url = `${EXTERNAL_URL.NBP.EXCHANGE_RATE_A}${toCurrency}/${formatDateISO(date)}?format=json`;

      try {
        const response = await fetch(url);
        console.log('res === ', response);
        const data = await response.json();

        if (data && data.rates && data.rates[0]?.mid) {
          return data.rates[0].mid;
        }
      } catch (e) {
        console.error('LINK ERROR: ', url);
        console.error(e);
      }

      // Try previous day
      date = subDays(date, 1);
      attempts++;
    }

    throw new Error('Could not find exchange rate after several attempts');
  } catch (e) {
    console.error(e);
    return new Error('Could not find exchange rate');
  }
};

export const convertDataToDesiredCurrency = async <
  T extends Record<string, unknown>,
>(
  data: T[],
  desiredCurrency: Currency,
  amountKey: keyof T,
  dateKey?: keyof T,
): Promise<T[]> => {
  const result: T[] = [];

  for (const item of data) {
    if (item.currency !== desiredCurrency) {
      const effectiveDate = dateKey ? (item[dateKey] as Date) : undefined;
      const convertedAmount = await convertMoney(
        item[amountKey] as number,
        desiredCurrency,
        item.currency as Currency,
        effectiveDate,
      );
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
