import type { PropsWithChildren } from 'react';
import { OnboardingPage } from '@/features/onboarding/onboarding-page.tsx';
import { PageLoader } from '@/components/loaders/page-loader.tsx';
import { useSettings } from '@/features/settings/use-settings.ts';
import { needsOnboarding } from '@/database/settings.service.ts';

export const OnboardingWrapper = ({ children }: PropsWithChildren) => {
  const { settings, isLoading } = useSettings();

  // ===========================================================================
  // Return
  // ===========================================================================
  if (isLoading || !settings) {
    return <PageLoader title="metrics.checking-actions" />;
  }

  if (needsOnboarding(settings)) {
    return <OnboardingPage />;
  }

  return children;
};
