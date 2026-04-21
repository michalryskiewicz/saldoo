import { useGetProfileQuery } from '@/store/profile-slice.api.ts';
import type { PropsWithChildren } from 'react';
import { OnboardingPage } from '@/features/onboarding/onboarding-page.tsx';
import { PageLoader } from '@/components/loaders/page-loader.tsx';

export const OnboardingWrapper = ({ children }: PropsWithChildren) => {
  const { data, isLoading } = useGetProfileQuery();

  // ===========================================================================
  // Return
  // ===========================================================================
  if (isLoading) {
    return <PageLoader title="metrics.checking-actions" />;
  }

  if (data?.requiredActions?.includes('onboarding')) {
    return <OnboardingPage />;
  }

  return children;
};
