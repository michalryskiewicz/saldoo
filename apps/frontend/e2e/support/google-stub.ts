import type { BrowserContext, Route } from '@playwright/test';
import { FOLDER_MIME, type FakeDrive } from './fake-drive.ts';

/**
 * Google, stubbed at the network boundary.
 *
 * Nothing in `src/` is swapped out or aware of the test: the real
 * `DriveFileGateway`, the real `DriveTokenService` and the real GIS bridge all run,
 * and what changes is only what comes back off the wire. A stub that replaced the
 * gateway would prove nothing about the code that ships — which is why the acceptance
 * criteria name this boundary explicitly.
 */

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';
const GOOGLE_HOSTS = ['accounts.google.com', 'www.googleapis.com', 'oauth2.googleapis.com'];

/** One signed-in Google account, shared by every device in a test — as it would be. */
export const STUB_ACCOUNT = {
  accessToken: 'e2e-drive-access-token',
  id: 'e2e-google-subject',
  email: 'e2e@saldoo.test',
  name: 'E2E Tester',
};

/**
 * Stands in for Google Identity Services.
 *
 * `initTokenClient` is the whole contract the app depends on, and the token arrives
 * through the callback asynchronously exactly as GIS delivers it — a synchronous
 * callback would let the app pass a test that a real browser would fail.
 */
const FAKE_GIS_SCRIPT = `
window.google = window.google || {};
window.google.accounts = window.google.accounts || {};
window.google.accounts.oauth2 = {
  initTokenClient: function (config) {
    return {
      requestAccessToken: function () {
        setTimeout(function () {
          config.callback({
            access_token: ${JSON.stringify(STUB_ACCOUNT.accessToken)},
            expires_in: 3600,
          });
        }, 0);
      },
    };
  },
};
`;

/** Public NBP rates, which this suite is not about. One fixed table, so totals are stable. */
const EXCHANGE_RATES = { PLN: {}, USD: {}, EUR: {} };

export type StubOptions = {
  /**
   * Read on every request rather than captured, so a test can take a device offline
   * mid-flight. Google requests then fail the way a disconnected network fails, which
   * `route.abort` reproduces and `context.setOffline` alone does not — an intercepted
   * request never reaches the network stack.
   */
  isOffline: () => boolean;
};

function bearerToken(route: Route): string | undefined {
  const header = route.request().headers()['authorization'];

  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/**
 * @throws nothing — an unhandled Google URL is fulfilled with a 501 carrying the URL,
 * so a call the harness forgot shows up as a named failure rather than a hang.
 */
async function handleDrive(route: Route, url: URL, drive: FakeDrive) {
  const request = route.request();
  const method = request.method();

  // The real gateway always carries the token it just obtained. Refusing anonymous
  // calls keeps the auth path load-bearing instead of decorative.
  if (!bearerToken(route)) {
    return json(route, { error: { code: 401, message: 'Missing credentials' } }, 401);
  }

  const upload = url.pathname.startsWith('/upload/drive/v3/files/');
  const fileId = upload
    ? url.pathname.slice('/upload/drive/v3/files/'.length)
    : url.pathname.slice('/drive/v3/files/'.length);

  if (upload && method === 'PATCH') {
    if (!drive.read(fileId)) return json(route, { error: { code: 404 } }, 404);

    drive.write(fileId, request.postData() ?? '');

    return json(route, { id: fileId });
  }

  if (method === 'GET' && url.searchParams.has('q')) {
    const files = drive.list(url.searchParams.get('q') ?? '');

    return json(route, { files: files.map(({ id, size, modifiedTime }) => ({ id, size, modifiedTime })) });
  }

  if (method === 'GET' && url.searchParams.get('alt') === 'media') {
    const file = drive.read(fileId);
    if (!file) return json(route, { error: { code: 404 } }, 404);

    return route.fulfill({ status: 200, contentType: 'application/json', body: file.content });
  }

  if (method === 'POST') {
    const metadata = JSON.parse(request.postData() ?? '{}');
    const created = drive.create({
      name: metadata.name,
      mimeType: metadata.mimeType ?? 'application/json',
      parents: metadata.parents,
    });

    return json(route, { id: created.id, name: created.name, mimeType: created.mimeType });
  }

  if (method === 'DELETE') {
    drive.remove(fileId);

    return route.fulfill({ status: 204, body: '' });
  }

  return json(route, { error: `Fake Drive has no handler for ${method} ${url.pathname}` }, 501);
}

export async function installGoogleStub(
  context: BrowserContext,
  drive: FakeDrive,
  { isOffline }: StubOptions
): Promise<void> {
  await context.route(
    (url) => GOOGLE_HOSTS.includes(url.hostname),
    async (route) => {
      if (isOffline()) return route.abort('internetdisconnected');

      const url = new URL(route.request().url());

      if (url.href.startsWith(GIS_SCRIPT)) {
        return route.fulfill({
          status: 200,
          contentType: 'text/javascript',
          body: FAKE_GIS_SCRIPT,
        });
      }

      if (url.pathname === '/oauth2/v3/userinfo') {
        if (bearerToken(route) !== STUB_ACCOUNT.accessToken) {
          return json(route, { error: 'invalid_token' }, 401);
        }

        return json(route, {
          sub: STUB_ACCOUNT.id,
          email: STUB_ACCOUNT.email,
          name: STUB_ACCOUNT.name,
        });
      }

      if (url.pathname === '/revoke') return json(route, {});

      if (url.pathname.startsWith('/drive/v3/files') || url.pathname.startsWith('/upload/')) {
        return handleDrive(route, url, drive);
      }

      return json(route, { error: `Unstubbed Google call: ${url.href}` }, 501);
    }
  );

  // The rates backend caches public NBP data and holds nothing of the user's, so it is
  // out of this suite's scope — but left unstubbed the SPA fallback answers with HTML
  // and every currency conversion silently reads it.
  await context.route('**/api/exchange/**', async (route) => {
    if (isOffline()) return route.abort('internetdisconnected');

    await json(route, EXCHANGE_RATES);
  });
}

export { FOLDER_MIME };
