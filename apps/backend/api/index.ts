import express from 'express';
import exchangeRatesRange from './exchange-rates/exchange-rates-range.controller.ts';
import bondOffers from './bond-offers/bond-offers.controller.ts';

const router = express.Router();

router.use('/exchange/range', exchangeRatesRange);
router.use('/bonds/offers', bondOffers);

export default router;
