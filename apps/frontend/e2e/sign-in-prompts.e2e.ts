import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * What the app asks Google for on the way in.
 *
 * The one thing no other test can see. A prompt value is not behaviour anybody can click
 * on, but it decides whether a window may appear without a gesture — and the app spent a
 * long time asking for `''`, which Google honours as "not every time" rather than "never".
 *
 * Recorded by the GIS stub in `support/google-stub.ts`.
 */

type RecordedAsk = { prompt?: string; login_hint?: string | null };

const recordedAsks = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => (window as unknown as { __gisRequests?: RecordedAsk[] }).__gisRequests ?? []
  ) as Promise<RecordedAsk[]>;

test('a returning browser session asks Google silently, and aims at the remembered account', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  // Closing the browser is what clears the session: the token goes, the vault witness goes,
  // the remembered address stays. Reloading with the session emptied is that morning after.
  await device.page.evaluate(() => sessionStorage.clear());
  await device.page.reload();
  await app.expectAsksForPassphrase();

  const asks = await recordedAsks(device.page);

  expect(asks.length).toBeGreaterThan(0);

  for (const ask of asks) {
    // `none` is the documented "display nothing". Nothing on this path was clicked, so
    // anything Google chose to render would meet the popup blocker rather than the person.
    expect(ask.prompt).toBe('none');
    // Without the hint a background renewal takes whichever account the browser has
    // active, and the wrong one finds no keyfile — which the app reports as a broken vault.
    expect(ask.login_hint).toBe('e2e@saldoo.test');
  }

  await device.close();
});
