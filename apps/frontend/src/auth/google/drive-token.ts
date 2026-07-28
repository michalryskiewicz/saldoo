import { CONFIG, GOOGLE_ENDPOINTS } from '@/global-config.ts';
import { DriveTokenService } from '@/auth/google/drive-token.service.ts';
import { createGisRequestToken } from '@/auth/google/gis-token-client.ts';
import { createSessionTokenCache } from '@/auth/google/session-token-cache.ts';

export const driveTokenService = new DriveTokenService(
  createGisRequestToken(CONFIG.googleClientId, GOOGLE_ENDPOINTS.LOGIN_DRIVE),
  createSessionTokenCache()
);

export const getDriveAccessToken = () => driveTokenService.getAccessToken();
