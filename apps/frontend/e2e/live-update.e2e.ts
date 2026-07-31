import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * A record added on one screen has to show up on the others without a reload.
 *
 * Dexie is a read model projected from the document, and every screen reads it through
 * `useLiveQuery`. If a projection does not land — or lands in a table nobody is watching —
 * the app looks like it swallowed the record, and the only way back is F5.
 */
test('an expense shows up straight away, on its own page and on the overview', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  // The overview knows of nothing yet, which is the baseline the assertion below needs.
  await app.open('/dashboard');
  await expect(device.page.getByText(pl.empty_state.no_dominant_expense)).toBeVisible();

  await app.addExpense({ description: 'Czynsz', amount: 2500 });

  // Same page, no reload: the drawer closed, so the write is done and the table must have it.
  await app.expectExpenses(['Czynsz']);

  // And the overview, derived from the same projection. Asserted by what it *says* rather
  // than by an amount: every figure there is scaled by the expense's frequency, so the number
  // typed into the form never appears on screen and matching on it proves nothing.
  await app.open('/dashboard');
  await expect(device.page.getByText(pl.maximum_expense)).toBeVisible({ timeout: 15_000 });
  await expect(device.page.getByText(pl.empty_state.no_dominant_expense)).toHaveCount(0);

  await device.close();
});

test('a second expense updates a page already showing the first', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addExpense({ description: 'Czynsz', amount: 2500 });
  await app.expectExpenses(['Czynsz']);

  // The interesting case is the second one: the first render happened when the table was
  // empty, so this is the update path rather than the initial read.
  await app.addExpense({ description: 'Kawa', amount: 18 });
  await app.expectExpenses(['Czynsz', 'Kawa']);

  await device.close();
});
