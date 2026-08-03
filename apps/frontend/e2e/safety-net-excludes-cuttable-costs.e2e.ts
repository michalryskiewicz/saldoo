import { test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * That the emergency fund sizes itself on what would still be owed with no income.
 *
 * Both halves matter and only together. A fund that grew by the gym membership would have a
 * person save up for a year of a subscription they would cancel in the first week; a fund that
 * refused to grow at all would pass a test that only checked the second expense.
 */
test('a cost you would cancel without a job is left out of the emergency fund', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addExpense({ description: 'Czynsz', amount: 1000, frequency: 'MONTHLY' });
  await app.expectSafetyNet('3_months', 3300);

  await app.addExpense({
    description: 'Siłownia',
    amount: 100,
    frequency: 'MONTHLY',
    survivesIncomeLoss: false,
  });
  await app.expectSafetyNet('3_months', 3300);

  await app.addExpense({ description: 'Prąd', amount: 200, frequency: 'MONTHLY' });
  await app.expectSafetyNet('3_months', 3960);

  await device.close();
});
