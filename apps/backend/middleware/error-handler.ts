import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'HTTP_ERROR',
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

type ErrorBody = {
  success: false;
  code: string;
  message: string;
  issues?: { path: string; message: string; code: string }[];
};

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const body: ErrorBody = {
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      issues: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof HttpError) {
    const body: ErrorBody = {
      success: false,
      code: err.code,
      message: err.message,
    };
    res.status(err.statusCode).json(body);
    return;
  }

  console.error('Unhandled error:', err);
  const body: ErrorBody = {
    success: false,
    code: 'INTERNAL',
    message: 'Internal server error',
  };
  res.status(500).json(body);
}
