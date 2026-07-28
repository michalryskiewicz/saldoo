import type { NextFunction, Request, Response } from 'express';
import { RateLimiter } from '../utils/rate-limiter.ts';
import { HttpError } from './error-handler.ts';

const MAX_REQUESTS_PER_WINDOW = 120;
const WINDOW_MS = 60_000;
const PRUNE_INTERVAL_MS = 5 * 60_000;

const limiter = new RateLimiter(MAX_REQUESTS_PER_WINDOW, WINDOW_MS);

setInterval(() => limiter.prune(), PRUNE_INTERVAL_MS).unref();

/**
 * Guards the only remaining endpoint.
 *
 * It serves public NBP rates and needs no identity, so there is nothing to
 * authenticate — but an unauthenticated proxy still has to be kept from being used
 * as free bandwidth against NBP.
 */
export function rateLimitMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const caller = req.ip ?? 'unknown';

  if (!limiter.tryConsume(caller)) {
    return next(new HttpError(429, 'Too many requests', 'RATE_LIMITED'));
  }

  next();
}
