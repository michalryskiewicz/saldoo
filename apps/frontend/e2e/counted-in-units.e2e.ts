import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * A holding somebody counts rather than one they weigh.
 *
 * An ETF holding is known as "100 × 4,32", and typing one figure instead is a multiplication the
 * person did in their head and cannot check a month later. So the form asks the way they know it, and
 * the worth every other screen prints is worked out from that — one stored figure, arrived at
 * honestly.
 */
test('an ETF is entered as units and a price, and the worth follows', async ({
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
  await device.page.getByRole('button', { name: pl.holdings.create, exact: true }).click();

  const sheet = device.page.getByRole('dialog', { name: pl.holdings.create_title });
  await expect(sheet).toBeVisible();

  await sheet.getByLabel(pl.holdings.what, { exact: true }).fill('VWCE');

  // Before a type is chosen the worth is asked for outright, because most things have no units.
  await expect(sheet.getByLabel(pl.holdings.value, { exact: true })).toBeVisible();

  await sheet.getByRole('combobox', { name: pl.holdings.asset_type }).click();
  await device.page.getByRole('option', { name: pl.holdings.type.ETF, exact: true }).click();

  // Now it asks the way somebody actually knows an ETF holding, and stops asking for the total.
  await sheet.getByLabel(pl.holdings.units, { exact: true }).fill('100');
  await sheet.getByLabel(pl.holdings.unit_price, { exact: true }).fill('4.32');

  const worth = sheet.locator('[data-slot="worth-from-units"]');
  await expect(worth).toContainText('432,00 zł');

  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();

  // The multiplication is what every other screen reads, and it survived the vault.
  const row = () => device.page.getByRole('row').filter({ hasText: 'VWCE' });
  await expect(row().getByText('432,00 zł').first()).toBeVisible();

  await device.page.reload();
  await app.open('/dashboard/wealth');
  await expect(row().getByText('432,00 zł').first()).toBeVisible();

  // Reopened, it still reads as a count and a price rather than as a total somebody typed.
  await row()
    .getByRole('button', { name: new RegExp(`^${pl.edit} —`) })
    .click();
  await expect(sheet.getByLabel(pl.holdings.units, { exact: true })).toHaveValue('100');

  expect(device.problems()).toEqual([]);

  await device.close();
});
