import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * What a holding earned, told apart from what was put into it.
 *
 * The fact anybody investing by hand wants and a stored value cannot carry: 3 000 in an account says
 * nothing about whether it was earned or paid in. It needs no new field — declaring into a goal and
 * then pointing a holding at it leaves both halves on record, and the declarations stop counting
 * towards progress while staying exactly the register of what went in.
 */
test('a holding says what it earned apart from what was put into it', async ({
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
  await app.putAside('IKE', 2000);
  await app.putAside('IKE', 500);

  // The account it all went into turns out to hold more than was declared, which is the ordinary
  // case for anything invested and the whole reason the two figures differ.
  await app.addPosition({ what: 'Konto IKE', worth: 3000, forGoal: 'IKE', share: 100 });

  const row = () => device.page.getByRole('row').filter({ hasText: 'Konto IKE' });

  await app.openHoldingsTab('untyped');

  await expect(row().getByText('500,00 zł', { exact: true })).toBeVisible();
  await expect(row()).toContainText('2500,00 zł');

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * And says nothing where the arrangement cannot answer it.
 *
 * Half an account towards a goal leaves "which half of the declarations landed here" unanswerable.
 * Apportioning them would be the app inventing the one thing this figure exists to be: a fact.
 */
test('a holding only partly serving a goal says nothing about what it earned', async ({
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

  await app.addPosition({ what: 'Konto wspólne', worth: 3000, forGoal: 'IKE', share: 60 });

  await app.openHoldingsTab('untyped');

  const row = device.page.getByRole('row').filter({ hasText: 'Konto wspólne' });
  await expect(row).toBeVisible();

  // The holding is there and its worth is there; the split is not, and no figure stands in for it.
  await expect(row.getByText('3000,00 zł').first()).toBeVisible();
  await expect(row).not.toContainText('2500,00 zł');

  expect(device.problems()).toEqual([]);

  await device.close();
});
