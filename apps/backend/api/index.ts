import express from 'express';
import profile from './profile/profile.controller.ts';
import exchangeRatesRange from './exchange-rates/exchange-rates-range.controller.ts';

const router = express.Router();

router.use('/profile', profile);
router.use('/exchange/range', exchangeRatesRange);

export default router;
