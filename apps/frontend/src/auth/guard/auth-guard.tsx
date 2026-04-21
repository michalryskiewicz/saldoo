import { useState, useEffect, type PropsWithChildren } from 'react';
import { useAuth } from '../hooks';
import { usePathname, useRouter } from '@/routes/hooks';
import { paths } from '@/routes/paths.ts';
import { PageLoader } from '@/components/loaders/page-loader.tsx';

export function AuthGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();

  const { isAuthenticated, loading } = useAuth();

  const [isChecking, setIsChecking] = useState(true);

  const createRedirectPath = (currentPath: string) => {
    const queryString = new URLSearchParams({ returnTo: pathname }).toString();
    return `${currentPath}?${queryString}`;
  };

  const checkPermissions = async (): Promise<void> => {
    if (loading) {
      return;
    }

    if (!isAuthenticated) {
      const redirectPath = createRedirectPath(paths.auth.google.signIn);

      router.replace(redirectPath);

      return;
    }

    setIsChecking(false);
  };

  useEffect(() => {
    checkPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loading]);

  if (isChecking) {
    return <PageLoader title="metrics.loading" />;
  }

  return <>{children}</>;
}
