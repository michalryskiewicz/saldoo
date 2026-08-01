import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * That income can be ended too, and that the table says so.
 *
 * A contract that finished has the same problem an ended subscription has: leaving it standing
 * reports money that is not arriving. This asks the whole way through — the field saves, and the
 * row reads its ending back — because a field wired to the wrong name typechecks perfectly and
 * saves nothing.
 */
test('a profit that has been ended reads its ending back', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addProfit({
    description: 'Umowa',
    amount: 4000,
    frequency: 'MONTHLY',
    endsOnDayOfMonth: 20,
  });

  const row = device.page.getByRole('row').filter({ hasText: 'Umowa' });
  await expect(row).toContainText('do 20');

  await device.page.reload();
  await app.openProfits();
  await expect(device.page.getByRole('row').filter({ hasText: 'Umowa' })).toContainText('do 20');

  await device.close();
});
