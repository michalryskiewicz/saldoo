import { resolveTokenPrompt } from './token-prompt.service.ts';
import {
  TokenRequestError,
  type GoogleTokenResponse,
  type RequestToken,
} from './drive-token.service.ts';

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

type GisTokenClient = {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
};

type GisTokenClientConfig = {
  client_id: string;
  scope: string;
  prompt?: string;
  login_hint?: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: { type?: string; message?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: GisTokenClientConfig) => GisTokenClient;
        };
      };
    };
  }
}

let scriptLoad: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (scriptLoad) return scriptLoad;

  scriptLoad = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity')));
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

  return scriptLoad;
}

export type GisRequestTokenOptions = {
  clientId: string;
  scope: string;
  /**
   * Read per request rather than once at construction: the hint is unknown on a device's
   * first sign-in and known immediately after it.
   */
  getLoginHint: () => string | null;
};

/**
 * Bridges {@link RequestToken} onto Google Identity Services.
 *
 * Failures keep the code Google gave them, as a {@link TokenRequestError}, so downstream
 * can tell a withdrawn grant from a dropped connection — flattening them into one error is
 * how a revoked grant used to retry forever without telling anybody.
 */
export function createGisRequestToken({
  clientId,
  scope,
  getLoginHint,
}: GisRequestTokenOptions): RequestToken {
  return async ({ silent }) => {
    await loadGisScript();

    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) throw new Error('Google Identity Services unavailable');

    const hint = getLoginHint();

    return new Promise<GoogleTokenResponse>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope,
        prompt: resolveTokenPrompt(silent, hint),
        ...(hint ? { login_hint: hint } : {}),
        callback: (response) => {
          if (response.access_token) resolve(response);
          else reject(new TokenRequestError(response.error));
        },
        error_callback: (error) => reject(new TokenRequestError(error.type)),
      });

      client.requestAccessToken();
    });
  };
}
