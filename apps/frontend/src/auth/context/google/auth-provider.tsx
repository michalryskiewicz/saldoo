import { useMemo, type PropsWithChildren } from 'react';
import { AuthContext } from '../auth-context';
import { authClient } from '@/lib/auth-client';

export type AuthContextValue = {
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
  loading: boolean;
  isAuthenticated: boolean;
};

export function AuthProvider({ children }: PropsWithChildren) {
  const { isPending, data } = authClient.useSession();

  const checkAuthenticated = data?.user ? 'authenticated' : 'unauthenticated';

  const status = isPending ? 'loading' : checkAuthenticated;

  const memoizedValue = useMemo(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    () => ({
      user: data?.user ? { ...data.user } : null,
      loading: status === 'loading',
      isAuthenticated: status === 'authenticated',
    }),
    [data?.user, status]
  );

  return <AuthContext value={memoizedValue}>{children}</AuthContext>;
}
