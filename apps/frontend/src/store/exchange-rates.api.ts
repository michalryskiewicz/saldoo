import { baseApi } from '@/lib/base-api.ts';
import { endpoints } from '@/lib/axios.ts';
import type { Currency } from '@/constant';

export type ListExchangeRatesResponseDTO = Record<Currency, Record<string, number | null>>;

export const exchangeRatesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listExchangeRates: build.query<
      ListExchangeRatesResponseDTO,
      { fromDate: string; toDate: string }
    >({
      query: ({ fromDate, toDate }) => {
        return {
          url: `${endpoints.exchange}/range/${fromDate}/${toDate}`,
          method: 'GET',
        };
      },
    }),
  }),
});

export const { useListExchangeRatesQuery } = exchangeRatesApi;
