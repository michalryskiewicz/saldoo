import { test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * That calling an occurrence off actually calls it off.
 *
 * This is the defect the skip replaced a delete for, and it is only visible after the fact.
 * Deleting a duty reported success and left an empty row where it had been — and then the next
 * generation of that range minted it again, because a duty's identity is worked out from its
 * expense and absence is never information.
 *
 * So the test leaves and comes back twice: once through the month picker, which regenerates,
 * and once through a reload, which rebuilds from the document. A skip that survives neither is
 * the old bug wearing a new label.
 */
test('an occurrence called off stays called off through a regeneration and a reload', async ({
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

  // Neither owed nor paid, so it belongs under neither tab — and it has to stay reachable
  // somewhere, or an accidental skip would be unrecoverable.
  await app.chooseDutyStatus('unpaid');
  await app.expectSkippedDuties(0);
  await app.chooseDutyStatus('all');
  await app.expectSkippedDuties(1);

  // Away and back through the month picker: this is what regenerates the range.
  await app.stepDutiesMonth('next');
  await app.stepDutiesMonth('previous');
  await app.expectSkippedDuties(1);

  await device.page.reload();
  await app.openDuties();
  await app.expectSkippedDuties(1);

  await device.close();
});
