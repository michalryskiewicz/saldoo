import { createApi } from '@reduxjs/toolkit/query/react';
import { CONFIG } from '@/global-config.ts';
import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosRequestConfig } from 'axios';
import axiosInstance from '@/lib/axios.ts';
import { ApiError, type ApiErrorIssue } from '@/lib/api-error.ts';

export type BaseQueryError = {
  status?: number;
  code?: string;
  message: string;
  issues?: ApiErrorIssue[];
};

const axiosBaseQuery =
  (
    { baseUrl }: { baseUrl: string } = { baseUrl: '' }
  ): BaseQueryFn<
    {
      url?: string;
      method?: AxiosRequestConfig['method'];
      data?: AxiosRequestConfig['data'];
      params?: AxiosRequestConfig['params'];
      headers?: AxiosRequestConfig['headers'];
    },
    unknown,
    BaseQueryError
  > =>
  async ({ url, method, data, params, headers }) => {
    try {
      const result = await axiosInstance({
        url: baseUrl + url,
        method,
        data,
        params,
        headers,
      });

      return { data: result.data };
    } catch (rawError) {
      const error =
        rawError instanceof ApiError
          ? rawError
          : new ApiError(
              (rawError as Error)?.message ?? 'Something went wrong!',
            );

      return {
        error: {
          status: error.status,
          code: error.code,
          message: error.message,
          issues: error.issues,
        },
      };
    }
  };

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery({ baseUrl: CONFIG.serverUrl }),
  endpoints: () => ({}),
});
