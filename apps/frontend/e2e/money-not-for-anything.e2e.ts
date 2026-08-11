import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

const amountOf = (text: string) =>
  Number(
    text
      .replace(/−/g, '-')
      .replace(/\s/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '')
  );

const addPosition = async (
  app: SaldooApp,
  { what, worth, forGoal, share }: { what: string; worth: number; forGoal?: string; share?: number }
) => {
  await app.open('/dashboard/wealth');
  await app.page.getByRole('button', { name: pl.holdings.create, exact: true }).click();

  const sheet = app.page.getByRole('dialog', { name: pl.holdings.create_title });
  await expect(sheet).toBeVisible();

  await sheet.getByLabel(pl.holdings.what, { exact: true }).fill(what);
  await sheet.getByLabel(pl.holdings.value, { exact: true }).fill(String(worth));

  if (forGoal) {
    await sheet.getByRole('combobox', { name: pl.holdings.assigned_to }).click();
    await app.page.getByRole('option', { name: forGoal, exact: true }).click();
    await sheet.getByLabel(pl.holdings.assigned_share, { exact: true }).fill(String(share ?? 100));
  }

  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();
};

/**
 * Money that is somewhere and is not for anything.
 *
 * The figure the whole assignment idea exists to make sayable, and it was computed and tested and
 * shown nowhere — which leaves the reader to work out a subtraction the app already knows the
 * answer to. Said beside what is held and what is owed, because it is the third fact of the same
 * kind: how much of what you hold has not been promised.
 */
test('what is held says how much of it is not for anything', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  // Funded by holdings, since a goal that reads declarations has nothing to point a position at.
  await app.addGoal({
    description: 'Poduszka',
    target: 20000,
    deadlineDayOfMonth: 15,
    funding: 'holdings',
  });

  await addPosition(app, { what: 'Konto', worth: 10000, forGoal: 'Poduszka', share: 60 });

  await app.openOverview();

  const free = device.page.locator('[data-slot="unassigned"]');

  // 60% of ten thousand is spoken for, so four thousand is not.
  await expect.poll(async () => amountOf((await free.textContent()) ?? '')).toBe(4000);

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * And says nothing while there is nothing to say.
 *
 * Before anybody assigns anything, what is free is what is held — so the line would repeat its
 * neighbour on every account that has never touched an assignment, which is most of them.
 */
test('what is held says nothing about free money before anything is assigned', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await addPosition(app, { what: 'Konto', worth: 10000 });

  await app.openOverview();

  // The tile itself is there — this is about the one line on it.
  await expect(device.page.locator('[data-slot="net-worth"]')).toBeVisible();
  await expect(device.page.locator('[data-slot="unassigned"]')).toBeHidden();

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * A percentage thins in silence.
 *
 * The share is fixed but what it is a share *of* is not, so spending out of the account the fund
 * sits in shrinks the fund — and shrinks the free figure with it. That the arithmetic follows the
 * holding down is the point of reading a stock rather than a ledger, and it is worth pinning that
 * it does.
 */
test('spending out of an assigned holding leaves less of it for anything', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addGoal({
    description: 'Poduszka',
    target: 20000,
    deadlineDayOfMonth: 15,
    funding: 'holdings',
  });

  await addPosition(app, { what: 'Konto', worth: 10000, forGoal: 'Poduszka', share: 60 });
  await addPosition(app, { what: 'Skarbonka', worth: 2000 });

  await app.openOverview();

  const free = device.page.locator('[data-slot="unassigned"]');

  // Four thousand left of the account, and all of the second holding.
  await expect.poll(async () => amountOf((await free.textContent()) ?? '')).toBe(6000);

  expect(device.problems()).toEqual([]);

  await device.close();
});
