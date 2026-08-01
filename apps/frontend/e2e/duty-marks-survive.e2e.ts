import { test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * That a payment already recorded outlives an edit to the expense that produced it.
 *
 * The defect this covers passed every test there was, because the tests asked whether the
 * write happened. It did — and then regeneration deleted it. What was never asked was
 * whether the mark was still there afterwards, which is the only thing the person who
 * ticked it cares about.
 *
 * So both halves are asserted after the fact: once the expense has been edited underneath
 * the duty, and again after a reload, since the mark lives in a synced document rather
 * than in the page.
 */
test('an occurrence marked paid stays paid when the expense behind it is edited', async ({
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

  await app.openDuties();
  await app.markDutyPaid('Czynsz');
  await app.expectPaidDuties(1);

  // Monthly to weekly: every occurrence the month had is now one the definition would not
  // produce, so the sweep considers all of them — including the one that was paid.
  await app.changeExpenseFrequency('Czynsz', 'WEEKLY');

  await app.openDuties();
  await app.expectPaidDuties(1);

  await device.page.reload();
  await app.openDuties();
  await app.expectPaidDuties(1);

  await device.close();
});
