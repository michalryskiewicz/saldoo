import { useEffect, type PropsWithChildren } from 'react';
import { useAuth } from '../hooks';
import { decideAuthAccess } from './auth-access.service.ts';
import { usePathname, useRouter } from '@/routes/hooks';
import { useIsOnline } from '@/hooks/use-is-online.ts';
import { paths } from '@/routes/paths.ts';
import { AppLoading } from '@/components/loaders/app-loading.tsx';

export function AuthGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuth();
  const isOnline = useIsOnline();

  const access = decideAuthAccess({ isLoading: loading, isAuthenticated, isOnline });

  useEffect(() => {
    if (access !== 'redirect') return;

    const returnTo = new URLSearchParams({ returnTo: pathname }).toString();
    router.replace(`${paths.auth.google.signIn}?${returnTo}`);
  }, [access, pathname, router]);

  if (access !== 'allow') return <AppLoading />;

  return children;
}
