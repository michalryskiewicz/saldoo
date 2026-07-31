import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { DOCUMENT_FILE, PASSPHRASE } from './support/fixtures.ts';

/**
 * Writing with no network must not look like failing.
 *
 * The local database is the source of truth, so an expense added offline is already
 * saved — the upload is owed, not pending approval. Before the outbox existed every
 * mutator awaited the upload inside the same `try/catch` as the local write, so an
 * offline user was told the expense could not be added while the record sat safely in
 * IndexedDB. That is the regression this guards.
 */
test('an expense added offline is saved, reported as offline, and sent once reconnected', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();
  await app.openExpenses();
  await app.publishNow();

  const beforeOffline = drive.contents(DOCUMENT_FILE);

  await device.setOffline(true);
  await app.addExpense({ description: 'Kawa', amount: 18 });

  // Saved, and said so: on screen, with the indicator naming the reason the change has
  // not left the device rather than an error.
  await app.expectExpenses(['Kawa']);
  await app.expectChangesPending();
  await app.expectNoSyncFailure();
  await expect(device.page.getByRole('alert')).toHaveCount(0);

  // Nothing reached Drive, which is the point of the offline case — the record is owed,
  // not lost.
  expect(drive.contents(DOCUMENT_FILE)).toBe(beforeOffline);

  await device.setOffline(false);

  // Reconnecting, not reopening, is what has to publish it: a device that stayed stale
  // until a reload would lose the change the moment the tab closed.
  await app.waitUntilSynced();
  expect(drive.contents(DOCUMENT_FILE)).not.toBe(beforeOffline);

  await app.reopen();
  await app.expectExpenses(['Kawa']);

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * The flush that lets the upload debounce be as long as it is.
 *
 * Without it the debounce had to stay near two seconds, because a person who makes one change
 * and switches away would otherwise leave it on this device alone.
 */
test('leaving the tab publishes straight away instead of waiting out the debounce', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  // Counting writes rather than comparing contents: every upload re-encrypts with a fresh
  // IV, so identical state produces different bytes and "did the file change" answers the
  // wrong question.
  const uploads = () => drive.writeLog().filter((write) => write.name === DOCUMENT_FILE).length;

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();
  // On the page before the baseline, so the navigation cannot be what triggers an upload.
  await app.openExpenses();
  await app.publishNow();

  const before = uploads();
  await app.addExpense({ description: 'Kawa', amount: 18 });

  // A fixed wait, because the claim is about time: well inside the debounce, nothing has
  // gone out yet.
  await device.page.waitForTimeout(1_500);
  expect(uploads()).toBe(before);

  await app.leaveTab();

  await expect.poll(uploads, { timeout: 5_000 }).toBeGreaterThan(before);

  await device.close();
});
