import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * Every part of the leading figure leads to the screen that authors it.
 *
 * The figure is derived from four tables nobody sees on this page, so "where does that come from"
 * is the first question it provokes — and the cheapest honest answer is to make each line of the
 * breakdown the way there. No copy explains this; the links are the explanation.
 */
test('each part of what is free leads to the screen it comes from', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addProfit({ description: 'Faktura klient A', amount: 10000, frequency: 'MONTHLY' });
  await app.addExpense({ description: 'Czynsz', amount: 2500, frequency: 'MONTHLY' });

  await app.openOverview();

  const card = device.page.locator('[data-slot="card"]').filter({
    has: device.page.getByText(pl.free_this_month.title),
  });

  await expect(card.getByRole('link', { name: pl.free_this_month.planned_income })).toHaveAttribute(
    'href',
    '/dashboard/profits'
  );
  await expect(card.getByRole('link', { name: pl.free_this_month.spent })).toHaveAttribute(
    'href',
    '/dashboard/transactions'
  );
  await expect(card.getByRole('link', { name: pl.free_this_month.goals })).toHaveAttribute(
    'href',
    '/dashboard/goals'
  );

  // Clicked rather than only read: an href that resolves to a route nobody registered is a link
  // that looks right in the DOM and lands on nothing.
  await card.getByRole('link', { name: pl.free_this_month.owed }).click();
  await expect(device.page).toHaveURL(/\/dashboard\/duties$/);

  expect(device.problems()).toEqual([]);

  await device.close();
});
