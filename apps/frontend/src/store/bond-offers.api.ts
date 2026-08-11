import { baseApi } from '@/lib/base-api.ts';
import { endpoints } from '@/lib/axios.ts';
import type { BondOfferDTO } from '@/features/net-worth/services/bond-offers.service.ts';

/**
 * The retail bond offer as the backend last read it.
 *
 * Public data about somebody else's product, so this asks for nothing and says nothing about the
 * person asking. A failure here is not an error state anywhere in the app: the catalogue shipped in
 * the bundle answers on its own, and this only ever adds months to it.
 */
export const bondOffersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listBondOffers: build.query<BondOfferDTO[], void>({
      query: () => ({ url: endpoints.bondOffers, method: 'GET' }),
    }),
  }),
});

export const { useListBondOffersQuery } = bondOffersApi;
