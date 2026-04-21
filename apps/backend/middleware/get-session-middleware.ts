import { auth } from '../auth';
import { fromNodeHeaders } from 'better-auth/node';
import { type Request, type Response, type NextFunction } from 'express';

export async function getSessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'No session found!',
    }) as unknown as Promise<void>;
  }

  // Attach userId to req.session
  req.session = { userId: session.session.userId };

  next();
}
