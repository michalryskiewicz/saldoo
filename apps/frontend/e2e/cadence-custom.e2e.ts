import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * That a cadence nobody named can still be given, and that the form says it in Polish.
 *
 * The named choices cover what people mostly have; this is the escape hatch that keeps every
 * other cycle expressible, and without it the select would be the enum #91 rejected. The unit
 * is declined by the number in front of it, which is the quietest thing here to break: nothing
 * fails, the form just reads "co 2 tygodni" to somebody who is looking straight at it.
 */
test('an unusual cycle is spelled out, and the unit follows the number', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();
  await app.openCreateForm();

  const sheet = device.page.getByRole('dialog', { name: pl.create_expense_title });
  const unit = sheet.getByLabel(pl.forms['cadence-unit'], { exact: true });
  const every = sheet.getByLabel(pl.cadence.every, { exact: true });

  await expect(every).toBeHidden();

  await sheet.getByLabel(pl.forms.cadence, { exact: true }).click();
  await device.page.getByRole('option', { name: pl.cadence.CUSTOM, exact: true }).click();

  await every.fill('2');
  await expect(unit).toHaveText(pl.units.week_few);

  await every.fill('5');
  await expect(unit).toHaveText(pl.units.week_many);

  await sheet.getByLabel(pl.description, { exact: true }).fill('Rower');
  await sheet.getByLabel(pl.expense, { exact: true }).fill('300');
  await sheet.getByLabel(pl.forms['first-execution'], { exact: true }).click();
  await device.page.getByRole('gridcell').filter({ hasText: /^15$/ }).first().click();
  await sheet.getByLabel(pl.forms.category, { exact: true }).click();
  await device.page.getByRole('option').first().click();
  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();

  // The row reads back the cadence that was given, in the words a person would use for it.
  await expect(device.page.getByRole('row').filter({ hasText: 'Rower' })).toContainText(
    'co 5 tygodni'
  );

  await device.close();
});
