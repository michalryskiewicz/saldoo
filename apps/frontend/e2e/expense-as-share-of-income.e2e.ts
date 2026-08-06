import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * A flat-rate tax, entered the way it is actually owed.
 *
 * Four things have to hold at once and each of them was a separate decision, so each is asserted
 * rather than inferred from the row looking plausible: the amount column says what the cost is a
 * share *of* instead of the nought that is stored; a year of it is the months added up rather than
 * one amount times twelve; the emergency fund never covers it; and the answer survives a reload,
 * which is the only proof the three fields on screen became one object in the vault.
 */
test('a cost can be entered as a share of a named income', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addExpense({ description: 'Czynsz', amount: 1000, frequency: 'MONTHLY' });
  await app.addProfit({ description: 'Faktura klient A', amount: 10000, frequency: 'MONTHLY' });

  await app.addExpense({
    description: 'Ryczałt',
    shareOfIncome: { percent: 12, income: 'Faktura klient A' },
    frequency: 'MONTHLY',
  });

  // What it is a share of, not the nought stored in its amount.
  await app.openExpenses();
  await expect(device.page.getByText('12% z Faktura klient A')).toBeVisible();

  // A monthly invoice of 10 000 means 1 200 of tax in each of the twelve months. Counted month by
  // month: one amount times twelve is exactly what a share cannot be.
  await app.searchFor('Ryczałt');
  expect(await app.footerTotal()).toContain('14400,00');

  // Three months of the rent and none of the tax — a share of an income is nothing when there is
  // no income, so the fund has nothing to cover.
  await app.clearSearch();
  await app.expectSafetyNet('3_months', 3300);

  // The three fields became one object, and came back as three.
  await device.page.reload();
  await app.openExpenses();
  await expect(device.page.getByText('12% z Faktura klient A')).toBeVisible();

  expect(device.problems()).toEqual([]);

  await device.close();
});
