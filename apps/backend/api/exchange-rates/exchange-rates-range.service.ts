import prisma from '../../prisma/prisma.ts';
import { EXTERNAL_URL } from '../../config/constant.ts';
import Cache from '../../utils/cache.ts';
import { formatDateISO, getDatesInRange } from '../../utils';
import { type Currency, CURRENCY } from '../../utils/types.ts';
import { singleton } from 'tsyringe';
import { subDays } from 'date-fns';

/**
 * How far before a window to look for the rate that stood when it opened.
 *
 * Ten days clears the longest run NBP publishes nothing for — the holidays around Christmas and
 * New Year — and every ordinary weekend with room to spare.
 */
const ANCHOR_LOOKBACK_DAYS = 10;

@singleton()
export class ExchangeRatesRangeService {
  constructor() {}

  async getExchangeRatesForDateRangeUsingNBPRange(
    fromCurrency: Currency,
    toCurrency: Currency,
    fromDate: Date,
    toDate: Date,
  ): Promise<Record<string, number | null>> {
    const requestedDates = getDatesInRange(fromDate, toDate);

    const today = new Date();
    const todayISO = formatDateISO(today);

    // A gap is filled from a day before it, so a window that opens on a gap could not be filled at
    // all — and two days in seven are a gap. Reaching back past the window is what makes its first
    // day fillable. Anchored before the earlier of the window and today, because a window of duties
    // still to fall lies wholly in the future: no day of it has a rate, and reaching back inside it
    // finds nothing either.
    const anchorFrom = subDays(
      new Date(
        Math.min(new Date(requestedDates[0] ?? todayISO).getTime(), today.getTime()),
      ),
      ANCHOR_LOOKBACK_DAYS,
    );

    // Sorted, because the fill below reads "the last rate published before this one" as "earlier in
    // this array" — an ordering three spreads happen to produce and nothing else enforces.
    const dates = [
      ...new Set([
        ...getDatesInRange(anchorFrom, today),
        ...requestedDates,
        todayISO,
      ]),
    ].sort();

    const results: { date: string; rate: number | null }[] = dates.map((d) => ({
      date: d,
      rate: null,
    }));

    if (fromCurrency === toCurrency) {
      for (const r of results) r.rate = 1;
      return this.toRecord(results);
    }

    const needFromPLN = fromCurrency !== CURRENCY.PLN;
    const needToPLN = toCurrency !== CURRENCY.PLN;

    const fromDateISO = dates[0];

    // Never past today: NBP has no rate for a day that has not happened, and asking it for one
    // answers 404 for the whole range — losing the days it could have answered for.
    const lastDate = dates[dates.length - 1];
    const toDateISO = lastDate > todayISO ? todayISO : lastDate;

    const fromMap: Record<string, number | undefined> = {};
    const toMap: Record<string, number | undefined> = {};

    // Step 1: Try cache for each date for final pair
    const finalCacheChecks = await Promise.all(
      dates.map((d) =>
        Cache.get<number | null>(`${fromCurrency}-${toCurrency}-${d}`),
      ),
    );

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
      return this.toRecord(results);
    }

    // Step 2: Try DB for PLN rates we need (only for currency->PLN stored records)
    const promises: Promise<unknown>[] = [];

    if (needFromPLN) {
      promises.push(
        prisma.exchangeRate.findMany({
          where: {
            fromCurrency,
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
            fromCurrency: toCurrency,
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
        await Cache.set(
          `${toCurrency}-${CURRENCY.PLN}-${key}`,
          r.mid as number,
        );
      }
    }

    // Step 3: For missing currency dates, fetch from NBP range endpoint (one call per currency)
    let fetchedFromMap: Record<string, number> = {};
    let fetchedToMap: Record<string, number> = {};

    if (needFromPLN) {
      fetchedFromMap = await this.fetchPLNRangeFromNBP(
        fromCurrency as Currency,
        fromDateISO,
        toDateISO,
      );
    }
    if (needToPLN) {
      fetchedToMap = await this.fetchPLNRangeFromNBP(
        toCurrency as Currency,
        fromDateISO,
        toDateISO,
      );
    }

    // Combine maps (DB/cache/fetched) and fill result for every date
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      if (results[i].rate != null) continue;

      let fromMid: number | undefined | null = undefined;
      let toMid: number | undefined | null = undefined;

      if (fromCurrency === CURRENCY.PLN) {
        toMid =
          (await Cache.get<number | undefined>(
            `${toCurrency}-${CURRENCY.PLN}-${d}`,
          )) ??
          toMap[d] ??
          fetchedToMap[d] ??
          null;

        if (toMid == null) {
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
          await Cache.set(
            `${fromCurrency}-${toCurrency}-${d}`,
            results[i].rate,
          );
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

    return this.toRecord(results);
  }

  private toRecord(
    results: { date: string; rate: number | null }[],
  ): Record<string, number | null> {
    const rec: Record<string, number | null> = {};
    for (const it of results) rec[it.date] = it.rate;
    return rec;
  }

  /**
   * Fetch exchange rates for a currency (to PLN) from NBP range endpoint.
   * Returns an ordered array of {date, rate} for dates in requested range
   * plus today's date (if not already present) when available.
   */
  private async fetchPLNRangeFromNBP(
    currency: Currency,
    fromDate: string,
    toDate: string,
  ): Promise<Record<string, number>> {
    const url = `${EXTERNAL_URL.NBP.EXCHANGE_RATE_A}${currency}/${fromDate}/${toDate}/?format=json`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      const map: Record<string, number> = {};
      if (data && Array.isArray(data.rates)) {
        for (const r of data.rates) {
          if (r.effectiveDate && typeof r.mid === 'number') {
            map[r.effectiveDate] = r.mid;

            try {
              // One statement rather than read-then-write: the compound unique on
              // (fromCurrency, toCurrency, effectiveDate) makes this idempotent even
              // when two range requests overlap.
              const identity = {
                fromCurrency: currency,
                toCurrency: CURRENCY.PLN,
                effectiveDate: new Date(r.effectiveDate),
              };

              await prisma.exchangeRate.upsert({
                where: {
                  fromCurrency_toCurrency_effectiveDate: identity,
                },
                create: { ...identity, mid: r.mid },
                update: { mid: r.mid },
              });

              await Cache.set(
                `${currency}-${CURRENCY.PLN}-${r.effectiveDate}`,
                r.mid,
              );
            } catch (e) {
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
  }
}
