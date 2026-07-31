import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * The vault's two promises, neither of which a unit test can observe: a device that is
 * picked up cold is worth nothing to whoever picked it up, and one left alone locks
 * itself.
 */

/** Thirty-minute idle timeout, comfortably passed. */
const PAST_THE_IDLE_TIMEOUT_MS = 31 * 60_000;

test('a device that has never seen this vault asks for the passphrase', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();

  const first = await openDevice(browser, { drive, baseURL: baseURL! });
  const firstApp = new SaldooApp(first.page);
  await firstApp.open();
  await firstApp.createVault(PASSPHRASE);
  await firstApp.completeOnboarding();
  await firstApp.openExpenses();
  await firstApp.publishNow();

  // A second context: its own IndexedDB and its own session, so the data key it would
  // need has never existed here. The keyfile on Drive holds only the *wrapped* key.
  const second = await openDevice(browser, { drive, baseURL: baseURL! });
  const secondApp = new SaldooApp(second.page);
  await secondApp.open();

  await secondApp.expectAsksForPassphrase();
  // Never briefly open: the expenses page must not be reachable before the passphrase.
  await expect(second.page.getByRole('button', { name: 'Dodaj wydatek' })).toHaveCount(0);

  await secondApp.unlock(PASSPHRASE);
  await secondApp.openExpenses();

  await first.close();
  await second.close();
});

test('the vault locks itself after a stretch of inactivity', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL!, controlledClock: true });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();
  await app.openExpenses();

  // Nobody waits thirty real minutes in CI, and nobody should: the clock jumps past the
  // deadline and the lock the app armed fires on its own.
  await device.page.clock.fastForward(PAST_THE_IDLE_TIMEOUT_MS);

  await app.expectAsksForPassphrase();

  // And it really is locked, not merely showing the screen: unlocking is what brings the
  // data back.
  await app.unlock(PASSPHRASE);
  await app.openExpenses();

  await device.close();
});
