import express from 'express';
import { getSessionMiddleware } from '../../middleware';
import { getExchangeRatesForDateRange } from './exchange-rate.service.ts';
import rangeController from './exchange-rates-range.controller.ts';
import type { Currency } from '../../utils/types.ts';

const exchangeRates = express.Router();

// Mount new range-based controller
exchangeRates.use('/range', rangeController);

exchangeRates.get(
  '/:fromCurrency/:toCurrency/:fromDate/:toDate',
  getSessionMiddleware,
  async (req, res) => {
    const { fromCurrency, toCurrency, fromDate, toDate } = req.params;

    const exchangeRates = await getExchangeRatesForDateRange(
      fromCurrency as Currency,
      toCurrency as Currency,
      new Date(fromDate),
      new Date(toDate),
    );

    return res.status(200).json(exchangeRates);
  },
);

exchangeRates.get(
  '/:fromDate/:toDate',
  getSessionMiddleware,
  async (req, res) => {
    const { fromDate, toDate } = req.params;

    // Available currencies (excluding PLN) for this aggregated endpoint
    const availableCurrencies: Currency[] = ['USD', 'EUR'];

    // Build a map of exchange rates for each currency to PLN
    const exchangeRatesMap: Partial<
      Record<Currency, Record<string, number | null>>
    > = {};

    for (const fromCurrency of availableCurrencies) {
      const rates = await getExchangeRatesForDateRange(
        fromCurrency as Currency,
        'PLN',
        new Date(fromDate),
        new Date(toDate),
      );

      exchangeRatesMap[fromCurrency] = rates?.reduce(
        (acc, curr) => {
          acc[curr.date] = curr.rate;
          return acc;
        },
        {} as Record<string, number | null>,
      );
    }

    return res.status(200).json(exchangeRatesMap);
  },
);

export default exchangeRates;
