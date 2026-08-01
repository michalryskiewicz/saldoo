import i18n from '@/i18n.ts';

const ROOTS = {
  AUTH: '/auth',
  DASHBOARD: '/dashboard',
};

export const paths = {
  auth: {
    root: ROOTS.AUTH,
    google: {
      signIn: `${ROOTS.AUTH}/google/sign-in`,
    },
  },
  // DASHBOARD
  dashboard: {
    root: ROOTS.DASHBOARD,
    duties: `${ROOTS.DASHBOARD}/duties`,
    expenses: `${ROOTS.DASHBOARD}/expenses`,
    profits: `${ROOTS.DASHBOARD}/profits`,
    transactions: `${ROOTS.DASHBOARD}/transactions`,
    onboarding: `${ROOTS.DASHBOARD}/onboarding`,
  },
  account: {
    root: `${ROOTS.DASHBOARD}/account`,
  },
};

// In `paths.ts`
export type MetadataKey =
  | 'home'
  | 'sign-in'
  | 'sign-up'
  | 'request-password-reset'
  | 'reset-password'
  | 'root'
  | 'expenses'
  | 'duties'
  | 'profits'
  | 'account'
  | 'transactions';

export const METADATA: Record<MetadataKey, { title: string }> = {
  home: {
    title: i18n.t('metadata.home'),
  },
  'sign-in': {
    title: i18n.t('metadata.sign-in'),
  },
  'sign-up': {
    title: i18n.t('metadata.sign-up'),
  },
  'request-password-reset': {
    title: i18n.t('metadata.request-password-reset'),
  },
  'reset-password': {
    title: i18n.t('metadata.reset-password'),
  },
  root: {
    title: i18n.t('metadata.dashboard'),
  },
  expenses: {
    title: i18n.t('metadata.expenses'),
  },
  duties: {
    title: i18n.t('metadata.duties'),
  },
  profits: {
    title: i18n.t('metadata.profits'),
  },
  account: {
    title: i18n.t('metadata.account'),
  },
  transactions: {
    title: i18n.t('metadata.transactions'),
  },
};
