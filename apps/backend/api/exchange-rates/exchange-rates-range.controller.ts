import express from 'express';
import { getSessionMiddleware } from '../../middleware';
import { getExchangeRatesForDateRangeUsingNBPRange } from './exchange-rates-range.service.ts';
import type { Currency } from '../../utils/types.ts';
import { CURRENCY } from '../../utils/types.ts';

const router = express.Router();

// New route: returns rates for USD and EUR (relative to PLN) for the given date range
router.get('/:fromDate/:toDate', getSessionMiddleware, async (req, res) => {
  const { fromDate, toDate } = req.params;

  try {
    const currencies: Currency[] = [CURRENCY.USD, CURRENCY.EUR];

    const promises = currencies.map((cur) =>
      getExchangeRatesForDateRangeUsingNBPRange(
        cur as Currency,
        CURRENCY.PLN as Currency,
        new Date(fromDate),
        new Date(toDate),
      ),
    );

    const results = await Promise.all(promises);

    const response: Record<string, Record<string, number | null>> = {};
    for (let i = 0; i < currencies.length; i++) {
      // results[i] is a Record<string, number|null>
      response[currencies[i]] = results[i] as Record<string, number | null>;
    }

    return res.status(200).json(response);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

export default router;
