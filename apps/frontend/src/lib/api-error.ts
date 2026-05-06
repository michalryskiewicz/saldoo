export type ApiErrorIssue = {
  path: string;
  message: string;
  code: string;
};

export type ApiErrorBody = {
  success: false;
  code: string;
  message: string;
  issues?: ApiErrorIssue[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly issues?: ApiErrorIssue[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromAxios(payload: unknown, status?: number, fallback = 'Something went wrong!'): ApiError {
    const body = (payload ?? {}) as Partial<ApiErrorBody>;
    return new ApiError(
      body.message ?? fallback,
      status,
      body.code,
      body.issues,
    );
  }
}
