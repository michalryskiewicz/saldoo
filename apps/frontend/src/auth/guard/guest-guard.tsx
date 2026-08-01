import { useState, useEffect, type PropsWithChildren } from 'react';
import { useAuth } from '../hooks';
import { useSearchParams } from '@/routes/hooks';
import { CONFIG } from '@/global-config.ts';
import { AppLoading } from '@/components/loaders/app-loading.tsx';

export function GuestGuard({ children }: PropsWithChildren) {
  const searchParams = useSearchParams();

  const { loading, isAuthenticated } = useAuth();

  const returnTo = searchParams.get('returnTo') || CONFIG.auth.redirectPath;

  const [isChecking, setIsChecking] = useState(true);

  const checkPermissions = async (): Promise<void> => {
    if (loading) {
      return;
    }

    if (isAuthenticated) {
      window.location.href = returnTo;
      return;
    }

    setIsChecking(false);
  };

  useEffect(() => {
    checkPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loading]);

  if (isChecking) {
    return <AppLoading />;
  }

  return <>{children}</>;
}
