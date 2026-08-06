import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';

/**
 * What the unit guard cannot see: the built app, over HTTP, under the shipped
 * Content-Security-Policy.
 *
 * `src/__tests__/installable.test.ts` proves the files exist in the source tree at the sizes they
 * claim. It cannot prove the build serves them at the paths the manifest names, and it cannot prove
 * the policy lets a browser have them — the policy names no `manifest-src`, so the manifest is only
 * fetchable because `default-src 'self'` covers it. That is the kind of clause an unrelated edit
 * takes away, and the failure is invisible everywhere except on a phone that already installed the
 * app.
 */
test('the built app serves a manifest and every icon it names', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });

  await device.page.goto('/');
  await expect(device.page.locator('#root')).not.toBeEmpty();

  // Fetched from inside the page, so `connect-src` applies. Fetching it with Playwright's own
  // request context would bypass the policy and prove nothing about what a browser is allowed.
  const manifest = await device.page.evaluate(async () => {
    const response = await fetch('/manifest.webmanifest');

    return {
      status: response.status,
      body: (await response.json()) as { display: string; icons: { src: string }[] },
    };
  });

  expect(manifest.status).toBe(200);
  expect(manifest.body.display).toBe('standalone');

  const sources = [
    ...manifest.body.icons.map((icon) => icon.src),
    // Named only by the document, and the one iOS actually draws on the home screen.
    (await device.page.locator('link[rel="apple-touch-icon"]').getAttribute('href'))!,
  ];

  const served = await device.page.evaluate(
    (paths) =>
      Promise.all(
        paths.map(async (path) => {
          const response = await fetch(path);

          return {
            path,
            status: response.status,
            type: response.headers.get('content-type'),
          };
        })
      ),
    sources
  );

  for (const icon of served) {
    expect(icon, `${icon.path} is named but not served`).toEqual({
      path: icon.path,
      status: 200,
      // A path Vite did not copy is answered by the SPA fallback with the index document, at
      // status 200 — so the status alone says an icon is fine when what came back is HTML.
      type: expect.stringContaining('image/png'),
    });
  }

  expect(device.problems()).toEqual([]);

  await device.close();
});
