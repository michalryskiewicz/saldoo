import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * What a holding has done, which no single stored value can say.
 *
 * A position carries one worth and one date, so every re-valuation used to overwrite the only record
 * of the last — and a holding that cannot be compared with itself cannot be said to have grown.
 * Which is the fact anybody investing by hand actually wants.
 */
test('a holding re-valued says what it has done since the last reading', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addPosition({ what: 'Konto IKE', worth: 30000 });

  // The list lives behind its kind now; this holding was added without one.
  await app.openHoldingsTab('untyped');

  const row = () => device.page.getByRole('row').filter({ hasText: 'Konto IKE' });

  // Valued once, so there is nothing to have moved from — and the column says nothing rather than
  // nought, which would claim it had stayed flat.
  await expect(row().getByText('30 000,00 zł').first()).toBeVisible();
  // Exact, or the match is a substring of the worth beside it and the assertion proves nothing.
  await expect(row().getByText('0,00 zł', { exact: true })).toBeHidden();

  // Somebody looks at the account again and says what it is worth now.
  await row()
    .getByRole('button', { name: new RegExp(`^${pl.edit} —`) })
    .click();

  const sheet = device.page.getByRole('dialog', { name: pl.holdings.create_title });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel(pl.holdings.value, { exact: true }).fill('31500');

  // And says which day they are talking about. Two readings about the same day are one person
  // correcting themselves, not a holding that moved — so a re-valuation is a reading about a later
  // day, and the form asks for that day rather than assuming one.
  await sheet.getByLabel(pl.holdings.valued_on, { exact: true }).click();
  await device.page
    .getByRole('gridcell')
    .filter({ hasText: /^28$/ })
    .first()
    .click();

  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();

  // The worth is the new one, and beside it what it did to get there.
  await expect(row().getByText('31 500,00 zł').first()).toBeVisible();
  await expect(row().getByText('1500,00 zł').first()).toBeVisible();

  // It survived the vault rather than only the render: history that is not stored is not history.
  await device.page.reload();
  await app.openHoldingsTab('untyped');
  await expect(row().getByText('1500,00 zł').first()).toBeVisible();

  expect(device.problems()).toEqual([]);

  await device.close();
});
