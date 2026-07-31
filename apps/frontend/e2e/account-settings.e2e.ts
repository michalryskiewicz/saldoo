import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * Changing a setting after onboarding, which is a different path from choosing one during
 * it: the account screen writes through `saveSettings` into an existing record rather than
 * creating the first one, and the value has to come back on the next load to be worth
 * anything.
 */
test('a budgeting strategy chosen in settings is still chosen after a reload', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.openAccount();
  await app.chooseStrategy('60-30-10');
  await app.submitAccountSettings();

  // Saving with no word about it is why choosing a strategy read as "it does not work":
  // there was nothing on screen either way.
  await app.expectSavedNotice();
  await app.publishNow();

  await app.openAccount();
  await app.expectStrategy('60-30-10');

  // The reload is the assertion that matters: the radio holding its own selection proves
  // only that the click registered, not that anything was written.
  await device.page.reload();
  await app.openAccount();
  await app.expectStrategy('60-30-10');

  expect(device.problems()).toEqual([]);

  await device.close();
});

test('a currency chosen in settings survives a reload too', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.openAccount();
  await app.chooseCurrency('EUR');
  await app.submitAccountSettings();
  await app.expectSavedNotice();
  await app.publishNow();

  await device.page.reload();
  await app.openAccount();
  await app.expectCurrency('EUR');

  await device.close();
});
