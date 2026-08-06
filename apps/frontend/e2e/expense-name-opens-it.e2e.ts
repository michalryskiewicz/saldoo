import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * The name of a cost opens the cost, on both screens that show one.
 *
 * The duties table has led there since #58; the expenses table left the name as plain text, so the
 * same word did two different things depending on which screen you were on. Asserted on both,
 * because consistency between two screens is exactly the thing that rots when only one has a test.
 */
test('the name of a cost opens it, from the expenses table and from duties', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addExpense({ description: 'Czynsz', amount: 2500, frequency: 'MONTHLY' });

  const drawer = device.page.getByRole('dialog', { name: pl.create_expense_title });

  await app.openExpenses();
  await device.page.getByRole('button', { name: 'Czynsz', exact: true }).click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByLabel(pl.description, { exact: true })).toHaveValue('Czynsz');
  await device.page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();

  await app.openDuties();
  await device.page.getByRole('button', { name: 'Czynsz', exact: true }).first().click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByLabel(pl.description, { exact: true })).toHaveValue('Czynsz');

  expect(device.problems()).toEqual([]);

  await device.close();
});
