import { driveTokenService } from '@/auth/google/drive-token.ts';
import { revokeGoogleToken } from '@/auth/google/google-identity.service.ts';
import { vaultManager } from '@/database/sync/sync.container.ts';
import { CONFIG } from '@/global-config.ts';

export const signInWithGoogle = async (): Promise<void> => {
  await driveTokenService.connect();
  window.location.assign(CONFIG.auth.redirectPath);
};

/**
 * Signs out for real: the token goes back to Google, and the data key is dropped
 * so the next person on this device cannot open the vault.
 */
export const signOutFromGoogle = async (): Promise<void> => {
  try {
    await revokeGoogleToken(await driveTokenService.getAccessToken());
  } catch {
    // Nothing left to revoke — carry on clearing local state.
  }

  driveTokenService.disconnect();
  await vaultManager.lock();
};
