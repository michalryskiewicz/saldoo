import express from 'express';
import profile from './profile/profile.controller.ts';
import exchangeRates from './exchange-rates/exchange-rates.controller.ts';

const router = express.Router();

router.use('/profile', profile);

router.use('/exchange', exchangeRates);

export default router;
