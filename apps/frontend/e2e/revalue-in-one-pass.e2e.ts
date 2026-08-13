import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * Saying what everything is worth, in one pass.
 *
 * Typing figures by hand was never the tiring part of valuing holdings yourself — opening a drawer,
 * finding the field, saving and closing it, once per holding, was. One list, one date, one save.
 */
test('every holding is re-valued in one pass, and the history follows', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addPosition({ what: 'Konto', worth: 5000, assetType: 'SAVINGS_ACCOUNT' });
  await app.addPosition({ what: 'VWCE', worth: 7500, assetType: 'ETF' });
  // Owed money is not re-valued by looking it up, so it keeps out of this.
  await app.addPosition({ what: 'Kredyt', worth: 20000, owed: true });

  await app.open('/dashboard/wealth');

  const pass = device.page.locator('[data-slot="revalue-rows"]');
  await expect(pass).toBeVisible();
  await expect(pass).toContainText('Konto');
  await expect(pass).toContainText('VWCE');
  await expect(pass).not.toContainText('Kredyt');

  // One date for the whole pass, said once.
  await device.page.getByLabel(pl.holdings.revalue.as_of, { exact: true }).fill('2026-08-28');

  // Addressed by what the row says rather than by a test-only attribute keyed on the holding's id.
  const entry = (what: string) =>
    device.page.getByRole('listitem').filter({ hasText: what }).getByRole('spinbutton');

  // The account is asked for its total; the ETF for the price of one, because that is what a broker
  // shows. It was entered as one unit at 7 500, so 8 000 a unit is 8 000.
  await entry('Konto').fill('5200');
  await entry('VWCE').fill('8000');

  await device.page.getByRole('button', { name: pl.holdings.revalue.submit }).click();

  const rowFor = (what: string) => device.page.getByRole('row').filter({ hasText: what });

  // Both worths moved, in one go.
  await expect(rowFor('Konto').getByText('5200,00 zł').first()).toBeVisible();
  await expect(rowFor('VWCE').getByText('8000,00 zł').first()).toBeVisible();

  // And each pass leaves a reading behind, so the change column has a before to measure from — which
  // is the thing a single stored value could never give it.
  await expect(rowFor('Konto').getByText('200,00 zł').first()).toBeVisible();
  await expect(rowFor('VWCE').getByText('500,00 zł').first()).toBeVisible();

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * A row nobody touched is not an instruction.
 *
 * Blank means leave it alone; nought means the account is empty. Reading the first as the second would
 * wipe a holding somebody merely scrolled past.
 */
test('a blank row leaves its holding alone', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addPosition({ what: 'Konto', worth: 5000 });
  await app.addPosition({ what: 'Skarbonka', worth: 800 });

  await app.open('/dashboard/wealth');

  await device.page
    .getByRole('listitem')
    .filter({ hasText: 'Konto' })
    .getByRole('spinbutton')
    .fill('5200');
  await device.page.getByRole('button', { name: pl.holdings.revalue.submit }).click();

  const rowFor = (what: string) => device.page.getByRole('row').filter({ hasText: what });

  await expect(rowFor('Konto').getByText('5200,00 zł').first()).toBeVisible();
  await expect(rowFor('Skarbonka').getByText('800,00 zł').first()).toBeVisible();

  expect(device.problems()).toEqual([]);

  await device.close();
});
