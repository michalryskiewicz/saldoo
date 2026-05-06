import type { Middleware } from '@reduxjs/toolkit';
import { toast } from 'sonner';
import i18n from '@/i18n.ts';
import type { BaseQueryError } from '@/lib/base-api.ts';

type RejectedWithValueAction = {
  type: string;
  payload: unknown;
  meta?: { rejectedWithValue?: boolean; requestStatus?: string };
};

const isRejectedWithValueAction = (
  action: unknown,
): action is RejectedWithValueAction =>
  typeof action === 'object' &&
  action !== null &&
  typeof (action as RejectedWithValueAction).type === 'string' &&
  (action as RejectedWithValueAction).type.endsWith('/rejected') &&
  (action as RejectedWithValueAction).meta?.rejectedWithValue === true;

const isBaseQueryError = (value: unknown): value is BaseQueryError =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { message?: unknown }).message === 'string';

export const rtkQueryErrorMiddleware: Middleware = () => (next) => (action) => {
  if (isRejectedWithValueAction(action) && isBaseQueryError(action.payload)) {
    const { status, message } = action.payload;

    // 401 is handled by AuthGuard (redirect) — no toast needed.
    if (status !== 401) {
      toast.error(message || i18n.t('errors.generic'));
    }
  }

  return next(action);
};
