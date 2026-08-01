import { driveTokenService } from '@/auth/google/drive-token.ts';
import { loginHintStore } from '@/auth/google/login-hint.store.ts';
import { revokeGoogleToken } from '@/auth/google/google-identity.service.ts';
import { vaultManager } from '@/database/sync/sync.container.ts';
import { CONFIG } from '@/global-config.ts';

export const signInWithGoogle = async (): Promise<void> => {
  await driveTokenService.connect();
  window.location.assign(CONFIG.auth.redirectPath);
};

/**
 * Signs in as somebody else: the remembered account is dropped first, so Google shows the
 * chooser instead of aiming at the person who was here before.
 */
export const signInWithAnotherGoogleAccount = async (): Promise<void> => {
  loginHintStore.forget();
  await signInWithGoogle();
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
  // Signing out leaves no trace, and an address is a trace. The next person on this
  // device should not find it waiting on Google's chooser.
  loginHintStore.forget();
  await vaultManager.lock();
};
