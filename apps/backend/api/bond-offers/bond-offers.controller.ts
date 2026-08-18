import type { Request, Response } from 'express';
import { container, inject, injectable } from 'tsyringe';
import { rateLimitMiddleware } from '../../middleware';
import { BondOfferService } from './bond-offer.service.ts';
import { buildRouter, Get, UseMiddleware } from '../../utils/decorators.ts';

/**
 * What the Ministry published, for anybody who asks.
 *
 * Public data about somebody else's product, so there is nothing to authenticate and nothing about
 * the person asking. The app treats the answer as an addition to the catalogue it ships with rather
 * than as a dependency: an empty table, a dead backend or no network at all cost the newest month,
 * not the feature.
 */
@injectable()
export class BondOffersController {
  constructor(
    @inject(BondOfferService) private readonly bondOffers: BondOfferService,
  ) {}

  @Get('/')
  @UseMiddleware(rateLimitMiddleware)
  async list(_req: Request, res: Response) {
    const offers = await this.bondOffers.listOffers();

    res.status(200).json(offers);
  }
}

export default buildRouter(container.resolve(BondOffersController));
