import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * That a series can be stopped without losing what it already recorded.
 *
 * Deleting the expense was the only way to stop one, and it took every occurrence with it —
 * including which of them were paid and against which payment. So the two halves are asserted
 * separately: nothing is owed after the ending day, and everything before it is exactly as it
 * was. A test that only checked the first would pass on `remove`.
 */
test('an expense that has been ended stops being owed and keeps what it recorded', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addExpense({ description: 'Abonament', amount: 65, frequency: 'MONTHLY' });

  await app.openDuties();
  await app.markDutyPaid('Abonament');
  await app.expectPaidDuties(1);

  await app.stepDutiesMonth('next');
  await expect.poll(() => app.dutyRowCount()).toBe(1);

  await app.endExpense('Abonament', 20);

  await app.openDuties();
  await app.stepDutiesMonth('next');
  await expect.poll(() => app.dutyRowCount()).toBe(0);

  await app.stepDutiesMonth('previous');
  await app.expectPaidDuties(1);

  await device.page.reload();
  await app.openDuties();
  await app.expectPaidDuties(1);

  await device.close();
});
