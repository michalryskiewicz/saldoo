import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * Which currency somebody's wealth actually sits in.
 *
 * The question a single converted figure cannot answer, and the one that decides whether a fall in
 * that figure is something the person did or a rate they are carrying. Reading in euro while holding
 * in złoty, a weaker złoty takes the net worth down without one złoty having left.
 */
test('what is held says which currencies it sits in', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  // Entered in złoty, which is what the onboarding picked.
  await app.addPosition({ what: 'Konto', worth: 13500 });

  await app.openOverview();

  // On one currency there is nothing to say, and saying "100% in złoty" would only repeat the
  // figure above it.
  await expect(device.page.locator('[data-slot="net-worth"]')).toBeVisible();
  await expect(device.page.locator('[data-slot="currency-exposure"]')).toBeHidden();

  await app.openAccount();
  await app.chooseCurrency('EUR');
  await app.submitAccountSettings();
  await app.expectSavedNotice();

  // A second holding entered in euro. Said explicitly, because the form defaults to złoty whatever
  // the screen reads in — which is itself why the first holding is złoty.
  await app.addPosition({ what: 'Konto w euro', worth: 1000, currency: 'EUR' });

  await app.openOverview();

  const exposure = device.page.locator('[data-slot="currency-exposure"]');
  await expect(exposure).toBeVisible();

  // 13 500 zł at the stubbed 4.5 is 3 000 €, beside 1 000 € held as euro: three quarters to one.
  await expect(exposure).toContainText('PLN');
  await expect(exposure).toContainText('75%');
  await expect(exposure).toContainText('25%');

  // In the currency the screen reads, so the parts add up to the figure they sit under.
  await expect(exposure).toContainText('3000,00 €');
  await expect(exposure).toContainText('1000,00 €');

  expect(device.problems()).toEqual([]);

  await device.close();
});
