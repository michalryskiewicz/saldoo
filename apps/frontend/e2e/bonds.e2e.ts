import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

const amountOf = (text: string) =>
  Number(text.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));

/**
 * Bonds counted at what they are worth, worked out rather than typed.
 *
 * The whole difference between this and a hand-valued position is that nobody has to remember to
 * update it — so the assertion is on a figure the person never entered.
 */
test('treasury bonds are worth what the arithmetic says, and land in net worth', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.open('/dashboard/wealth');
  await device.page.getByRole('button', { name: pl.bonds.create, exact: true }).click();

  const sheet = device.page.getByRole('dialog', { name: pl.bonds.create_title });
  await expect(sheet).toBeVisible();

  await sheet.getByLabel(pl.bonds.series, { exact: true }).fill('EDO0335');
  await sheet.getByLabel(pl.bonds.quantity, { exact: true }).fill('100');
  await sheet.getByLabel(pl.bonds.rate, { exact: true }).fill('6.55');

  // The purchase date is left at today, so nothing has accrued yet and the holding is worth
  // exactly what was paid — which is the honest answer on day one.
  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();

  await expect(device.page.getByText('EDO0335')).toBeVisible();

  await app.openOverview();
  const tile = device.page.locator('[data-slot="net-worth"]');
  await expect.poll(async () => amountOf((await tile.textContent()) ?? '')).toBe(10000);

  expect(device.problems()).toEqual([]);

  await device.close();
});
