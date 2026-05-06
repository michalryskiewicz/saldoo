import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rtkQueryErrorMiddleware } from '../error.middleware.ts';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/i18n.ts', () => ({
  default: {
    t: (key: string) => key,
  },
}));

import { toast } from 'sonner';

const mockedToast = toast.error as ReturnType<typeof vi.fn>;

const buildStoreApi = () => ({
  dispatch: vi.fn(),
  getState: vi.fn(),
});

const runAction = (action: unknown) => {
  const next = vi.fn((a) => a);
  rtkQueryErrorMiddleware(buildStoreApi() as never)(next)(action as never);
  return next;
};

describe('rtkQueryErrorMiddleware', () => {
  beforeEach(() => {
    mockedToast.mockReset();
  });

  it('shows a toast for rejected actions with a server message', () => {
    runAction({
      type: 'api/executeQuery/rejected',
      payload: { status: 500, code: 'INTERNAL', message: 'Boom!' },
      meta: { rejectedWithValue: true, requestStatus: 'rejected' },
      error: { message: 'Rejected' },
    });

    expect(mockedToast).toHaveBeenCalledWith('Boom!');
  });

  it('falls back to a generic message when the payload has no message', () => {
    runAction({
      type: 'api/executeQuery/rejected',
      payload: { status: 500, message: '' },
      meta: { rejectedWithValue: true, requestStatus: 'rejected' },
      error: { message: 'Rejected' },
    });

    expect(mockedToast).toHaveBeenCalledWith('errors.generic');
  });

  it('skips the toast on 401 (handled by AuthGuard)', () => {
    runAction({
      type: 'api/executeQuery/rejected',
      payload: { status: 401, code: 'UNAUTHORIZED', message: 'No session' },
      meta: { rejectedWithValue: true, requestStatus: 'rejected' },
      error: { message: 'Rejected' },
    });

    expect(mockedToast).not.toHaveBeenCalled();
  });

  it('does nothing for non-rejected actions', () => {
    runAction({ type: 'api/executeQuery/fulfilled', payload: { hello: 'world' } });

    expect(mockedToast).not.toHaveBeenCalled();
  });

  it('forwards the action down the middleware chain', () => {
    const next = runAction({ type: 'noop' });
    expect(next).toHaveBeenCalledWith({ type: 'noop' });
  });
});
