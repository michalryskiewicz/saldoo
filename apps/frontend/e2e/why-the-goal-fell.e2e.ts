import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * Why a goal fell when nobody touched it.
 *
 * A goal reading its holdings reads an account, so spending out of that account takes the goal down.
 * The arithmetic is right and it is the whole point of reading a stock rather than a diary — but on
 * the screen it reads as a fault, or as something the person did and cannot remember, until the cause
 * is named beside it.
 */
test('a goal whose account was spent out of says so', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addGoal({ description: 'Poduszka', target: 20000, deadlineDayOfMonth: 15 });

  // Pointing the account at it switches the goal over to reading the account.
  await app.addPosition({ what: 'Konto', worth: 20000, forGoal: 'Poduszka', share: 100 });

  const card = () => device.page.locator('[data-slot="card"]').filter({ hasText: 'Poduszka' });

  await app.openGoals();
  await expect(card().getByText('20 000,00 zł').first()).toBeVisible();

  // Nothing to explain yet: the account has been valued once, so there is no before it moved from.
  await expect(card().locator('[data-slot="goal-moved"]')).toBeHidden();

  // The car broke, so five thousand left the account — and the person says what it is worth now.
  await app.open('/dashboard/wealth');
  await device.page
    .getByRole('row')
    .filter({ hasText: 'Konto' })
    .getByRole('button', { name: new RegExp(`^${pl.edit} —`) })
    .click();

  const sheet = device.page.getByRole('dialog', { name: pl.holdings.create_title });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel(pl.holdings.value, { exact: true }).fill('15000');
  await sheet.getByLabel(pl.holdings.valued_on, { exact: true }).click();
  await device.page
    .getByRole('gridcell')
    .filter({ hasText: /^28$/ })
    .first()
    .click();
  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();

  await app.openGoals();

  // The goal followed the account down — and the card says why, rather than leaving the reader to
  // wonder what they did wrong.
  await expect(card().getByText('15 000,00 zł').first()).toBeVisible();

  const moved = card().locator('[data-slot="goal-moved"]');
  await expect(moved).toBeVisible();
  await expect(moved).toContainText('5000,00 zł');

  expect(device.problems()).toEqual([]);

  await device.close();
});
