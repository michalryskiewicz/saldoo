import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import en from '../src/locales/en.json' with { type: 'json' };
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * Switching the language, and the part of it a unit test cannot reach.
 *
 * `locales.test.ts` already proves the two files agree. What it cannot prove is that the switch
 * takes effect *everywhere*, and that is the whole risk here: a great deal of this app calls
 * `i18n.t` at module scope, so those strings are fixed at import time and a plain
 * `changeLanguage` would leave a half-translated screen — the table headings in one language and
 * the buttons in another. `setLocale` reloads for exactly that reason, and only a browser can
 * confirm the reload carries the choice with it.
 */
test('the language switch reaches module-scope strings, and outlives a reload', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();
  await app.openExpenses();

  await expect(device.page.getByRole('button', { name: pl.create_expense })).toBeVisible();

  await app.chooseLanguage('en');

  // Evaluated once at import, in a module-level `columns` const: if the switch only re-rendered,
  // this heading would still be Polish while the button beside it turned English.
  await expect(
    device.page.locator('thead').getByText(en.frequency, { exact: true })
  ).toBeVisible();
  await expect(device.page.getByRole('button', { name: en.create_expense })).toBeVisible();
  await expect(device.page.getByRole('button', { name: pl.create_expense })).toHaveCount(0);

  // Remembered, not merely applied.
  await device.page.reload();
  await expect(device.page.getByRole('button', { name: en.create_expense })).toBeVisible();

  await app.chooseLanguage('pl');
  await expect(device.page.getByRole('button', { name: pl.create_expense })).toBeVisible();

  expect(device.problems()).toEqual([]);

  await device.close();
});
