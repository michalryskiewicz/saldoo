import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import { ingStatement } from './support/bank-statement.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * The figure the overview now leads with, against every kind of claim on the money at once.
 *
 * A unit test can prove the arithmetic and does. What it cannot prove is that the screen asks for
 * it with the whole account behind it — an income with a cadence, a cost that became an occurrence,
 * a statement line, and a goal with a deadline are four different tables, and the figure is only
 * true if all four arrive.
 */
test('the overview leads with what is free once everything with a claim on it is taken off', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addProfit({ description: 'Faktura klient A', amount: 10000, frequency: 'MONTHLY' });
  await app.addExpense({ description: 'Czynsz', amount: 2500, frequency: 'MONTHLY' });

  await app.importTransactions(
    ingStatement([{ date: '2026-08-03', title: 'BIEDRONKA 1234 WARSZAWA', amount: -213.47 }])
  );

  // 10 000 planned, 213.47 already gone, 2 500 still owed on a rent nobody has paid.
  await app.expectFreeThisMonth(7286.53);

  // No statement behind an ordinary month yet, so the app says it does not know rather than
  // printing a confident zero.
  await expect(device.page.getByText(pl.free_this_month.capacity_unknown)).toBeVisible();

  expect(device.problems()).toEqual([]);

  await device.close();
});
