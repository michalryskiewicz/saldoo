import { CONFIG, GOOGLE_SCOPES } from '@/global-config.ts';
import { DriveTokenService } from '@/auth/google/drive-token.service.ts';
import { createGisRequestToken } from '@/auth/google/gis-token-client.ts';
import { createSessionTokenCache } from '@/auth/google/session-token-cache.ts';
import { loginHintStore } from '@/auth/google/login-hint.store.ts';

export const driveTokenService = new DriveTokenService(
  createGisRequestToken({
    clientId: CONFIG.googleClientId,
    scope: GOOGLE_SCOPES,
    getLoginHint: () => loginHintStore.read(),
  }),
  createSessionTokenCache()
);

export const getDriveAccessToken = () => driveTokenService.getAccessToken();
