import { useEffect, useState } from 'react';
import { isGoogleDriveTokenValid } from '@/database/sync/googleDriveUtils.ts';

export function useGoogleDriveAuthStatus(intervalMs = 60 * 1000) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    async function check() {
      const valid = await isGoogleDriveTokenValid();

      if (mounted) setIsLoggedIn(valid);
    }

    check();
    const interval = setInterval(check, intervalMs);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [intervalMs]);

  return !!isLoggedIn;
}
