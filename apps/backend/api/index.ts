import express from 'express';
import exchangeRatesRange from './exchange-rates/exchange-rates-range.controller.ts';

const router = express.Router();

router.use('/exchange/range', exchangeRatesRange);

export default router;
