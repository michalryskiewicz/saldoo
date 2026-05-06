import { auth } from '../auth';
import { fromNodeHeaders } from 'better-auth/node';
import { type Request, type Response, type NextFunction } from 'express';
import { HttpError } from './error-handler.ts';

export async function getSessionMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    return next(new HttpError(401, 'No session found!', 'UNAUTHORIZED'));
  }

  req.session = { userId: session.session.userId };

  next();
}
