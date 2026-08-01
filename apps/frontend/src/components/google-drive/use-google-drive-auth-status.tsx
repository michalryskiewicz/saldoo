import { useCallback, useEffect, useState } from 'react';
import { driveTokenService } from '@/auth/google/drive-token.ts';

/**
 * Tracks whether this device currently holds a usable Drive token.
 *
 * Renewal is silent — the Drive scope is granted at login — so this is a status
 * indicator rather than a prompt. It only reads false when Google declines to renew
 * without interaction, which is the one case where reconnecting by hand helps.
 */
export function useGoogleDriveAuthStatus(intervalMs = 60 * 1000) {
  const [isConnected, setIsConnected] = useState(() => driveTokenService.hasFreshToken());

  const renew = useCallback(async () => {
    // Asked only when the held token has actually gone stale. This ran every interval
    // regardless, so a signed-in person sitting on a page generated a token request a
    // minute — the busiest source of requests nobody clicked for.
    if (driveTokenService.hasFreshToken()) return true;

    try {
      await driveTokenService.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const connected = await renew();
      if (mounted) setIsConnected(connected);
    };

    check();
    const interval = setInterval(check, intervalMs);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [intervalMs, renew]);

  return isConnected;
}
