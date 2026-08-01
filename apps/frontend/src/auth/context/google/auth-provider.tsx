import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AuthContext } from '../auth-context';
import { driveTokenService } from '@/auth/google/drive-token.ts';
import { fetchGoogleIdentity } from '@/auth/google/google-identity.service.ts';
import { loginHintStore } from '@/auth/google/login-hint.store.ts';

export type AuthContextValue = {
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
  loading: boolean;
  isAuthenticated: boolean;
};

/**
 * Derives the session from the single Google token.
 *
 * There is no server-side session to consult: holding a token Google will still
 * describe *is* being signed in. Renewal is silent, so a returning user is
 * recognised without any interaction.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthContextValue['user']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const identify = async () => {
      try {
        const accessToken = await driveTokenService.getAccessToken();
        const identity = await fetchGoogleIdentity(accessToken);

        // Remembered here rather than at the sign-in click, because this is the point
        // the account is *known* — and the hint is what aims the next silent renewal at
        // the same account instead of whichever one the browser has active.
        loginHintStore.remember(identity.email);

        if (!cancelled) {
          setUser({ id: identity.id, email: identity.email, name: identity.name });
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    identify();

    return () => {
      cancelled = true;
    };
  }, []);

  const memoizedValue = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: user !== null,
    }),
    [user, loading]
  );

  return <AuthContext value={memoizedValue}>{children}</AuthContext>;
}
