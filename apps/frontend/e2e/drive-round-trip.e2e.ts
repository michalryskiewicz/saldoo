import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { DOCUMENT_FILE, KEYFILE_NAME, PASSPHRASE } from './support/fixtures.ts';

/**
 * The stub proving itself, before any test relies on it.
 *
 * Nothing here is mocked inside the app: the real GIS bridge asks for a token, the real
 * `DriveFileGateway` resolves the folder and writes the file, and what a test controls
 * is only the answers coming off the wire. If this goes red, every other failure in the
 * suite is about the harness rather than about the app.
 */
test('a device signs in, creates its vault and publishes an expense to Drive', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);

  // The keyfile is published before the session unlocks, so a vault this device can open
  // is a vault every other device can find.
  expect(drive.contents(KEYFILE_NAME)).not.toBeNull();

  await app.completeOnboarding();
  await app.addExpense({ description: 'Czynsz', amount: 2500 });

  await expect
    .poll(() => drive.contents(DOCUMENT_FILE), { timeout: 15_000 })
    .not.toBeNull();

  // Encrypted, not merely uploaded: the description must not be recoverable from the
  // payload sitting in the user's own Drive.
  expect(drive.contents(DOCUMENT_FILE)).not.toContain('Czynsz');

  expect(device.problems()).toEqual([]);
});
