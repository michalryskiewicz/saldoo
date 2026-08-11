import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * The same money, counted once.
 *
 * A goal can read what was declared into it or what is held against it, and the two are exclusive
 * precisely because they are the same złoty seen from two ends. Choosing between them was left to
 * the person, so pointing an account at a goal that was still reading declarations left both
 * running: the goal counted what had been typed in, and the holding stood in net worth beside it.
 *
 * Assigning a holding is the moment somebody says where the money actually is, so it is the moment
 * the goal stops guessing from declarations. The declarations are not deleted — they are what the
 * person did, and a goal switched back reads them again.
 */
test('a goal reads the holding once one is pointed at it, not its declarations too', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  // Reads declarations, which is the form's own default and the ordinary starting point.
  await app.addGoal({ description: 'IKE', target: 30000, deadlineDayOfMonth: 15 });
  await app.putAside('IKE', 2500);

  const ike = () => device.page.locator('[data-slot="card"]').filter({ hasText: 'IKE' });

  await app.openGoals();
  await expect(ike().getByText('2500,00 zł').first()).toBeVisible();

  // The account the money went into turns out to be worth more than what was declared — which is
  // the ordinary case for anything invested, and the whole reason the two figures differ.
  await app.addPosition({ what: 'Konto IKE', worth: 3000, forGoal: 'IKE', share: 100 });

  await app.openGoals();

  // What is held, once. Not 2500, which was the declaration, and not 5500, which was never real.
  await expect(ike().getByText('3000,00 zł').first()).toBeVisible();
  await expect(ike().getByText('5500,00 zł')).toBeHidden();
  await expect(ike().getByText('2500,00 zł')).toBeHidden();

  // And the card names what it is now reading, so the changed figure is not a mystery.
  await expect(ike().locator('[data-slot="goal-backing"]')).toBeVisible();

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * The same thing along the path somebody actually walks.
 *
 * "Add to wealth" on a goal's own card is the plainest statement anybody makes about where a goal's
 * money is, and it used to end with the two counted separately: the drawer arrived with the name and
 * the amount filled in but pointed at nothing, and the assignment field would not even offer the
 * goal it had come from.
 */
test('adding a holding from a goal card leaves the goal reading that holding', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addGoal({ description: 'IKE', target: 30000, deadlineDayOfMonth: 15 });
  await app.putAside('IKE', 2500);

  const ike = () => device.page.locator('[data-slot="card"]').filter({ hasText: 'IKE' });

  await app.openGoals();
  await ike()
    .getByRole('button', { name: `${pl.goal.add_to_wealth} — IKE` })
    .click();

  const sheet = device.page.getByRole('dialog', { name: pl.holdings.create_title });
  await expect(sheet).toBeVisible();

  // Arrives naming the goal and carrying what was declared, and already pointed at it.
  await expect(sheet.getByLabel(pl.holdings.what, { exact: true })).toHaveValue('IKE');
  await expect(sheet.getByRole('combobox', { name: pl.holdings.assigned_to })).toContainText('IKE');

  // What the account is really worth, which is the number only the person knows.
  await sheet.getByLabel(pl.holdings.value, { exact: true }).fill('3000');
  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();

  await app.openGoals();

  await expect(ike().getByText('3000,00 zł').first()).toBeVisible();
  await expect(ike().getByText('2500,00 zł')).toBeHidden();

  expect(device.problems()).toEqual([]);

  await device.close();
});
