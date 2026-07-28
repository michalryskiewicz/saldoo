import type { GoogleTokenResponse, RequestToken } from './drive-token.service.ts';

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

type GisTokenClient = {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
};

type GisTokenClientConfig = {
  client_id: string;
  scope: string;
  prompt?: string;
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

/**
 * Bridges {@link RequestToken} onto Google Identity Services.
 *
 * `prompt: ''` asks GIS to reuse the consent already granted during login, which
 * is what makes the Drive connection survive in the background without a second
 * click. If Google cannot honour it, the rejection surfaces to the caller so the
 * UI can fall back to an interactive request.
 */
export function createGisRequestToken(clientId: string, scope: string): RequestToken {
  return async ({ silent }) => {
    await loadGisScript();

    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) throw new Error('Google Identity Services unavailable');

    return new Promise<GoogleTokenResponse>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope,
        prompt: silent ? '' : 'select_account consent',
        callback: (response) => {
          if (response.access_token) resolve(response);
          else reject(new Error(response.error ?? 'No access token returned'));
        },
        error_callback: (error) => reject(new Error(error.type ?? 'Token request failed')),
      });

      client.requestAccessToken();
    });
  };
}
