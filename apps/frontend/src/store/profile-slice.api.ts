import { baseApi } from '@/lib/base-api.ts';
import { endpoints } from '@/lib/axios.ts';
import { toast } from 'sonner';
import i18n from '@/i18n.ts';
import { BUDGETING_STRATEGIES, type Currency } from '@/constant.ts';

type GetProfileReqDto = {
  email: string;
  currency: Currency;
  strategy: keyof typeof BUDGETING_STRATEGIES;
  encryptionKey: string;
  tags: string[];
  requiredActions: string[];
};

export type UpdateProfileReqDto = {
  currency: Currency;
  strategy: keyof typeof BUDGETING_STRATEGIES;
};

export const profileSliceApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProfile: build.query<GetProfileReqDto, void>({
      query: () => ({
        url: endpoints.profile,
        method: 'GET',
      }),
    }),
    updateProfile: build.mutation<unknown, UpdateProfileReqDto>({
      query: (data) => ({
        url: endpoints.profile,
        method: 'POST',
        data,
      }),
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled;
          toast(i18n.t('success.update-account-settings'));
        } catch (e) {
          console.error(e);
          toast(i18n.t('errors.update-account-settings'));
        }
      },
    }),
  }),
});

export const { useGetProfileQuery, useUpdateProfileMutation } = profileSliceApi;
