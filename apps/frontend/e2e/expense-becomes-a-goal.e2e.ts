import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * Moving a cost that was never a cost.
 *
 * The two halves are asserted separately because only together do they mean anything: the goal has
 * to arrive carrying what the expense knew, and the expense has to *end* rather than disappear —
 * #70 is explicit that ending keeps every occurrence up to the ending day, and losing a year of
 * paid history is the one thing this must not cost anybody.
 */
test('an expense can be turned into the goal it always was', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addExpense({ description: 'IKE', amount: 2500, frequency: 'MONTHLY' });

  await app.openDuties();
  await app.markDutyPaid('IKE');
  await app.expectPaidDuties(1);

  await app.openExpenses();
  await device.page.getByRole('button', { name: pl.goal.convert }).first().click();

  // The form opens on the cost, already knowing what it can know.
  const sheet = device.page.getByRole('dialog', { name: pl.goal.create_title });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel(pl.description, { exact: true })).toHaveValue('IKE');
  // A year of a monthly 2 500.
  await expect(sheet.getByLabel(pl.goal.target, { exact: true })).toHaveValue(/30\s?000/);

  // The one thing it cannot know, answered by the person.
  await sheet.getByRole('radio', { name: pl.goal.kept, exact: true }).click();
  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();

  await expect(device.page.locator('[data-slot="card"]').filter({ hasText: 'IKE' })).toBeVisible();

  // Ended, not deleted: the row is still there and so is what was paid against it.
  await app.openExpenses();
  await expect(device.page.getByText('IKE').first()).toBeVisible();

  await app.openDuties();
  await app.expectPaidDuties(1);

  expect(device.problems()).toEqual([]);

  await device.close();
});
