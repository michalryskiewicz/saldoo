import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import { ingStatement } from './support/bank-statement.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * That the overview renders with every kind of record on the account at once.
 *
 * Its hook is the one place that joins all five tables — expenses, incomes, duties, transactions,
 * tags — and every figure on the page comes out of that one join. A spec with a single expense in
 * it exercises none of the joining, which is where an ordering mistake or a bad date would take
 * the whole page down rather than one tile.
 *
 * The console is asserted, not just the pixels: React renders nothing at all when a hook throws,
 * so "a tile is missing" and "the page is blank" have the same look and different causes.
 */
test('the overview renders with expenses, incomes, duties and transactions on the account', async ({
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
  await app.addExpense({
    description: 'Kawa',
    amount: 14.99,
    survivesIncomeLoss: false,
    frequency: 'DAILY',
  });
  await app.addExpense({ description: 'Ubezpieczenie', amount: 1980, frequency: 'YEARLY' });

  await app.addProfit({ description: 'Faktura klient A', amount: 10000, frequency: 'MONTHLY' });

  await app.importTransactions(
    ingStatement([{ date: '2026-08-03', title: 'BIEDRONKA 1234 WARSZAWA', amount: -213.47 }])
  );

  await app.openDuties();
  await app.markDutyPaid('Czynsz');

  await app.openOverview();

  await expect(device.page.getByText(pl.financial_safety_net.title)).toBeVisible();
  await expect(device.page.getByText(pl.monthly_spending_title)).toBeVisible();

  // Three months of the rent (3 × 2500) plus the one insurance premium that falls inside the
  // window — its yearly day is the 15th of this month, so it always lands in the first of the
  // three — and none of the coffee, which is a cost that would go. 9480, plus the 10% buffer.
  await app.expectSafetyNet('3_months', 10428);

  expect(device.problems()).toEqual([]);

  await device.close();
});
