import { createAuthClient } from 'better-auth/react';
import { CONFIG } from '@/global-config.ts';

export const authClient = createAuthClient({
  /** The base URL of the server (optional if you're using the same domain) */
  baseURL: CONFIG.serverUrl,
});
