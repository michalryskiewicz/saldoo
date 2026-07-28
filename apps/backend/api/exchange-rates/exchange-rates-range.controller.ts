import type { Request, Response } from 'express';
import { container, inject, injectable } from 'tsyringe';
import { rateLimitMiddleware } from '../../middleware';
import { ExchangeRatesRangeService } from './exchange-rates-range.service.ts';
import {
  buildRouter,
  Get,
  UseMiddleware,
  Validate,
} from '../../utils/decorators.ts';
import { getAggregatedRatesSchema } from './exchange-rates.dto.ts';
import { type Currency, CURRENCY } from '../../utils/types.ts';

@injectable()
export class ExchangeRatesRangeController {
  constructor(
    @inject(ExchangeRatesRangeService)
    private readonly exchangeRatesRangeService: ExchangeRatesRangeService,
  ) {}

  @Get('/:fromDate/:toDate')
  @Validate(getAggregatedRatesSchema)
  @UseMiddleware(rateLimitMiddleware)
  async getRangeRates(req: Request<{ fromDate: string; toDate: string }>, res: Response) {
    // Both params are guaranteed to be ISO dates by @Validate above.
    const { fromDate, toDate } = req.params;

    const currencies: Currency[] = [CURRENCY.USD, CURRENCY.EUR];

    const promises = currencies.map((cur) =>
      this.exchangeRatesRangeService.getExchangeRatesForDateRangeUsingNBPRange(
        cur,
        CURRENCY.PLN,
        new Date(fromDate),
        new Date(toDate),
      ),
    );

    const results = await Promise.all(promises);

    const response: Record<string, Record<string, number | null>> = {};
    for (let i = 0; i < currencies.length; i++) {
      response[currencies[i]] = results[i] as Record<string, number | null>;
    }

    res.status(200).json(response);
  }
}

export default buildRouter(container.resolve(ExchangeRatesRangeController));
