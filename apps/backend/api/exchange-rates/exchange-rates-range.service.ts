import prisma from '../../prisma/prisma.ts';
import { EXTERNAL_URL } from '../../config/constant.ts';
import Cache from '../../utils/cache.ts';
import { formatDateISO, getDatesInRange } from '../../utils';
import { type Currency, CURRENCY } from '../../utils/types.ts';

/**
 * Fetch exchange rates for a currency (to PLN) from NBP range endpoint.
 * Returns an ordered array of {date, rate} for dates in requested range
 * plus today's date (if not already present) when available.
 */
const fetchPLNRangeFromNBP = async (
  currency: Currency,
  fromDate: string,
  toDate: string,
): Promise<Record<string, number>> => {
  const url = `${EXTERNAL_URL.NBP.EXCHANGE_RATE_A}${currency}/${fromDate}/${toDate}/?format=json`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const map: Record<string, number> = {};
    if (data && Array.isArray(data.rates)) {
      for (const r of data.rates) {
        if (r.effectiveDate && typeof r.mid === 'number') {
          map[r.effectiveDate] = r.mid;

          // Save to DB if not exists
          try {
            const existing = await prisma.exchangeRate.findFirst({
              where: {
                fromCurrency: currency as unknown as CURRENCY,
                toCurrency: CURRENCY.PLN,
                effectiveDate: new Date(r.effectiveDate),
              },
            });

            if (!existing) {
              await prisma.exchangeRate.create({
                data: {
                  fromCurrency: currency as unknown as CURRENCY,
                  toCurrency: CURRENCY.PLN,
                  effectiveDate: new Date(r.effectiveDate),
                  mid: r.mid,
                },
              });
            }

            // Cache the single currency -> PLN rate
            await Cache.set(
              `${currency}-${CURRENCY.PLN}-${r.effectiveDate}`,
              r.mid,
            );
          } catch (e) {
            // swallow DB/cache errors but log
            console.error('Error saving PLN rate to DB/cache', e);
          }
        }
      }
    }

    return map;
  } catch (e) {
    console.error('Error fetching NBP range', url, e);
    return {};
  }
};

export const getExchangeRatesForDateRangeUsingNBPRange = async (
  fromCurrency: Currency,
  toCurrency: Currency,
  fromDate: Date,
  toDate: Date,
): Promise<Record<string, number | null>> => {
  // Build initial dates from requested range
  const requestedDates = getDatesInRange(fromDate, toDate); // returns yyyy-mm-dd strings

  // Ensure today's date is included if missing
  const todayISO = formatDateISO(new Date());
  const includeToday = !requestedDates.includes(todayISO);

  // Final dates array keeps requested order, and if we need to include today append it at the end
  const dates = includeToday
    ? [...requestedDates, todayISO]
    : requestedDates.slice();

  // Prepare result array in same order as dates
  const results: { date: string; rate: number | null }[] = dates.map((d) => ({
    date: d,
    rate: null,
  }));

  // Quick path when currencies are identical
  if (fromCurrency === toCurrency) {
    for (const r of results) r.rate = 1;
    const recIdent: Record<string, number | null> = {};
    for (const it of results) recIdent[it.date] = it.rate;
    return recIdent;
  }

  // Determine which PLN data we need to fetch
  const needFromPLN = fromCurrency !== CURRENCY.PLN;
  const needToPLN = toCurrency !== CURRENCY.PLN;

  // DB/API queries must cover the entire span including today's date when appended
  const fromDateISO = dates[0];
  const toDateISO = dates[dates.length - 1];

  // Prepare maps
  const fromMap: Record<string, number | undefined> = {};
  const toMap: Record<string, number | undefined> = {};

  // Step 1: Try cache for each date for final pair
  const finalCacheChecks = await Promise.all(
    dates.map((d) =>
      Cache.get<number | null>(`${fromCurrency}-${toCurrency}-${d}`),
    ),
  );

  // Fill results from cache where available
  const missingDates: string[] = [];
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const cached = finalCacheChecks[i];
    if (typeof cached === 'number') {
      results[i].rate = cached;
    } else {
      missingDates.push(d);
    }
  }

  if (missingDates.length === 0) {
    const recFull: Record<string, number | null> = {};
    for (const it of results) recFull[it.date] = it.rate;
    return recFull;
  }

  // Step 2: Try DB for PLN rates we need (only for currency->PLN stored records)
  const promises: Promise<unknown>[] = [];

  if (needFromPLN) {
    promises.push(
      prisma.exchangeRate.findMany({
        where: {
          fromCurrency: fromCurrency as unknown as CURRENCY,
          toCurrency: CURRENCY.PLN,
          effectiveDate: {
            gte: new Date(fromDateISO),
            lte: new Date(toDateISO),
          },
        },
      }),
    );
  } else {
    promises.push(Promise.resolve([]));
  }

  if (needToPLN) {
    promises.push(
      prisma.exchangeRate.findMany({
        where: {
          fromCurrency: toCurrency as unknown as CURRENCY,
          toCurrency: CURRENCY.PLN,
          effectiveDate: {
            gte: new Date(fromDateISO),
            lte: new Date(toDateISO),
          },
        },
      }),
    );
  } else {
    promises.push(Promise.resolve([]));
  }

  const [fromDbRates, toDbRates] = await Promise.all(promises);

  if (Array.isArray(fromDbRates)) {
    for (const r of fromDbRates) {
      const key = formatDateISO(r.effectiveDate);
      fromMap[key] = r.mid as number | undefined;
      await Cache.set(
        `${fromCurrency}-${CURRENCY.PLN}-${key}`,
        r.mid as number,
      );
    }
  }
  if (Array.isArray(toDbRates)) {
    for (const r of toDbRates) {
      const key = formatDateISO(r.effectiveDate);
      toMap[key] = r.mid as number | undefined;
      await Cache.set(`${toCurrency}-${CURRENCY.PLN}-${key}`, r.mid as number);
    }
  }

  // Step 3: For missing currency dates, fetch from NBP range endpoint (one call per currency)
  let fetchedFromMap: Record<string, number> = {};
  let fetchedToMap: Record<string, number> = {};

  if (needFromPLN) {
    fetchedFromMap = await fetchPLNRangeFromNBP(
      fromCurrency as Currency,
      fromDateISO,
      toDateISO,
    );
  }
  if (needToPLN) {
    fetchedToMap = await fetchPLNRangeFromNBP(
      toCurrency as Currency,
      fromDateISO,
      toDateISO,
    );
  }

  // Combine maps (DB/cache/fetched) and fill result for every date
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    // Skip if already filled from final-pair cache
    if (results[i].rate != null) continue;

    let fromMid: number | undefined | null = undefined;
    let toMid: number | undefined | null = undefined;

    if (fromCurrency === CURRENCY.PLN) {
      // PLN -> X: use X->PLN inverted
      toMid =
        (await Cache.get<number | undefined>(
          `${toCurrency}-${CURRENCY.PLN}-${d}`,
        )) ??
        toMap[d] ??
        fetchedToMap[d] ??
        null;

      if (toMid == null) {
        // forward-fill from previous dates
        for (let j = i - 1; j >= 0; j--) {
          const prev = dates[j];
          toMid =
            (await Cache.get<number | undefined>(
              `${toCurrency}-${CURRENCY.PLN}-${prev}`,
            )) ??
            toMap[prev] ??
            fetchedToMap[prev] ??
            null;
          if (toMid != null) break;
        }
      }

      if (toMid != null && toMid !== 0) {
        results[i].rate = 1 / toMid;
        await Cache.set(`${fromCurrency}-${toCurrency}-${d}`, results[i].rate);
      } else {
        results[i].rate = null;
      }

      continue;
    }

    if (toCurrency === CURRENCY.PLN) {
      fromMid =
        (await Cache.get<number | undefined>(
          `${fromCurrency}-${CURRENCY.PLN}-${d}`,
        )) ??
        fromMap[d] ??
        fetchedFromMap[d] ??
        null;

      if (fromMid == null) {
        for (let j = i - 1; j >= 0; j--) {
          const prev = dates[j];
          fromMid =
            (await Cache.get<number | undefined>(
              `${fromCurrency}-${CURRENCY.PLN}-${prev}`,
            )) ??
            fromMap[prev] ??
            fetchedFromMap[prev] ??
            null;
          if (fromMid != null) break;
        }
      }

      if (fromMid != null) {
        results[i].rate = fromMid;
        await Cache.set(`${fromCurrency}-${toCurrency}-${d}`, fromMid);
      } else {
        results[i].rate = null;
      }

      continue;
    }

    // Neither is PLN: need both
    fromMid =
      (await Cache.get<number | undefined>(
        `${fromCurrency}-${CURRENCY.PLN}-${d}`,
      )) ??
      fromMap[d] ??
      fetchedFromMap[d] ??
      null;
    toMid =
      (await Cache.get<number | undefined>(
        `${toCurrency}-${CURRENCY.PLN}-${d}`,
      )) ??
      toMap[d] ??
      fetchedToMap[d] ??
      null;

    if (fromMid == null || toMid == null) {
      for (let j = i - 1; j >= 0; j--) {
        const prev = dates[j];
        if (fromMid == null) {
          fromMid =
            (await Cache.get<number | undefined>(
              `${fromCurrency}-${CURRENCY.PLN}-${prev}`,
            )) ??
            fromMap[prev] ??
            fetchedFromMap[prev] ??
            null;
        }
        if (toMid == null) {
          toMid =
            (await Cache.get<number | undefined>(
              `${toCurrency}-${CURRENCY.PLN}-${prev}`,
            )) ??
            toMap[prev] ??
            fetchedToMap[prev] ??
            null;
        }
        if (fromMid != null && toMid != null) break;
      }
    }

    if (fromMid != null && toMid != null && toMid !== 0) {
      const mid = fromMid / toMid;
      results[i].rate = mid;
      await Cache.set(`${fromCurrency}-${toCurrency}-${d}`, mid);
    } else {
      results[i].rate = null;
    }
  }

  // Convert results array to record map for compatibility with controllers
  const rec: Record<string, number | null> = {};
  for (const it of results) rec[it.date] = it.rate;
  return rec;
};
