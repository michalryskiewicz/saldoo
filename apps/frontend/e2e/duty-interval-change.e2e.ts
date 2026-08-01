import { test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * That saying a cost recurs every second month does not throw away what was already settled.
 *
 * An occurrence is identified by the cadence it belongs to, so changing the interval mints a
 * different set — and regeneration sweeps whatever the definitions no longer call for. A mark is
 * not a definition: it is something the person did, and it survives the sweep or the sweep is
 * destroying answers rather than derived data (ADR 0001).
 *
 * The same property `duty-skip-survives.e2e.ts` holds for a change of frequency, checked here
 * for the field that did not exist when that test was written.
 */
test('an occurrence called off stays called off when the cadence around it changes', async ({
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
  await app.skipDuty('Czynsz');
  await app.expectSkippedDuties(1);

  await app.changeExpenseInterval('Czynsz', 2);

  await app.openDuties();
  await app.expectSkippedDuties(1);

  // And through a reload, which rebuilds from the document rather than from what the page held.
  await device.page.reload();
  await app.openDuties();
  await app.expectSkippedDuties(1);

  await device.close();
});
