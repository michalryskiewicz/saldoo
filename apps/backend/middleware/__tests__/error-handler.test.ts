import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { errorHandler, HttpError } from '../error-handler.ts';
import type { Request, Response, NextFunction } from 'express';

const buildRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('errorHandler', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = {} as Request;
    res = buildRes();
    next = vi.fn();
  });

  it('returns 400 with structured issues for ZodError', () => {
    let zodError: z.ZodError | undefined;
    try {
      z.object({ name: z.string() }).parse({ name: 42 });
    } catch (e) {
      zodError = e as z.ZodError;
    }

    errorHandler(zodError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues[0]).toMatchObject({ path: 'name' });
  });

  it('uses statusCode and code from HttpError', () => {
    errorHandler(new HttpError(403, 'Forbidden', 'FORBIDDEN'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: 'FORBIDDEN',
      message: 'Forbidden',
    });
  });

  it('falls back to a generic 500 for unknown errors', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(new Error('boom'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: 'INTERNAL',
      message: 'Internal server error',
    });
    errorSpy.mockRestore();
  });
});
