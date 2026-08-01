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
// Every ask, recorded. What the app requests of Google is a contract with no other
// witness: the prompt value alone decides whether a window can appear unbidden, and it is
// invisible to every other kind of test. Reset per document load, like GIS itself.
window.__gisRequests = [];
window.google.accounts.oauth2 = {
  initTokenClient: function (config) {
    return {
      requestAccessToken: function () {
        window.__gisRequests.push({
          prompt: config.prompt,
          login_hint: config.login_hint || null,
        });
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

/**
 * Public NBP rates, which this suite is not about — but they cannot be left empty.
 *
 * `convertMoney` logs an error for every date it cannot find a rate for, and this suite
 * fails tests on console errors, so an empty table would turn "the app has no rates" into
 * a failure about the harness. One fixed rate per currency, quoted for every day in the
 * requested range, keeps totals stable and the console clean.
 */
const FIXED_RATES = { PLN: 1, USD: 4, EUR: 4.5 };

/** A day either side, since a range endpoint is inclusive and callers round differently. */
const RANGE_MARGIN_DAYS = 1;
const MAX_RANGE_DAYS = 800;

function ratesForRange(fromDate: string, toDate: string) {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { PLN: {}, USD: {}, EUR: {} };
  }

  const days: string[] = [];
  const cursor = new Date(start.getTime() - RANGE_MARGIN_DAYS * 86_400_000);
  const last = end.getTime() + RANGE_MARGIN_DAYS * 86_400_000;

  while (cursor.getTime() <= last && days.length < MAX_RANGE_DAYS) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Object.fromEntries(
    Object.entries(FIXED_RATES).map(([currency, rate]) => [
      currency,
      Object.fromEntries(days.map((day) => [day, rate])),
    ])
  );
}

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

    const version = drive.write(fileId, request.postData() ?? '');

    // The real endpoint only returns what `fields` asks for, and the sync asks for the
    // version so it can tell its own write apart from somebody else's.
    return json(route, { id: fileId, version });
  }

  if (method === 'GET' && url.searchParams.has('q')) {
    const files = drive.list(url.searchParams.get('q') ?? '');

    return json(route, {
      files: files.map(({ id, size, modifiedTime, version }) => ({
        id,
        size,
        modifiedTime,
        version,
      })),
    });
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

    return json(route, {
      id: created.id,
      name: created.name,
      mimeType: created.mimeType,
      version: created.version,
    });
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

    const [fromDate, toDate] = new URL(route.request().url()).pathname.split('/').slice(-2);

    await json(route, ratesForRange(fromDate, toDate));
  });
}

export { FOLDER_MIME };
