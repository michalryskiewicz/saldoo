import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice, type Device } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * The epic's headline behaviour, in a browser.
 *
 * Two contexts — so two IndexedDBs, two sessions, two `navigator.onLine` flags — over
 * one shared fake Drive folder. Until this existed the merge was only ever proven at the
 * data layer, and "two real browser profiles against one Drive folder, in both sync
 * orders" was a line on a manual checklist.
 */

async function laptopWithVault(browser: Parameters<typeof openDevice>[0], drive: ReturnType<typeof createFakeDrive>, baseURL: string) {
  const device = await openDevice(browser, { drive, baseURL });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  // The settings live in the same document as everything else, so a second device can
  // only skip onboarding once this one has published them.
  await app.openExpenses();
  await app.publishNow();

  return { device, app };
}

/** A second device finds the keyfile already on Drive, so it unlocks rather than sets up. */
async function phoneJoining(browser: Parameters<typeof openDevice>[0], drive: ReturnType<typeof createFakeDrive>, baseURL: string) {
  const device = await openDevice(browser, { drive, baseURL });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.expectAsksForPassphrase();
  await app.unlock(PASSPHRASE);

  return { device, app };
}

async function closeAll(...devices: Device[]) {
  for (const device of devices) await device.close();
}

test('two devices on one Drive folder keep both expenses', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();

  const laptop = await laptopWithVault(browser, drive, baseURL!);
  const phone = await phoneJoining(browser, drive, baseURL!);

  // The settings travel in the same document, so the second device is not asked to
  // choose a currency and a strategy all over again.
  await phone.app.openExpenses();

  // Each writes while it cannot reach Drive: this is the case where a last-writer-wins
  // upload used to throw one of the two away.
  await laptop.device.setOffline(true);
  await phone.device.setOffline(true);

  await laptop.app.addExpense({ description: 'Czynsz', amount: 2500 });
  await phone.app.addExpense({ description: 'Kawa', amount: 18 });

  await laptop.device.setOffline(false);
  await phone.device.setOffline(false);

  // Both orders, which is what the manual checklist asked a human to remember: the phone
  // publishes onto what the laptop left, then the laptop takes the merge back.
  await phone.app.reopen();
  await laptop.app.reopen();

  await laptop.app.expectExpenses(['Czynsz', 'Kawa']);
  await phone.app.expectExpenses(['Czynsz', 'Kawa']);

  expect(laptop.device.problems()).toEqual([]);
  expect(phone.device.problems()).toEqual([]);

  await closeAll(laptop.device, phone.device);
});

test('a deletion on one device is not restored by the other', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();

  const laptop = await laptopWithVault(browser, drive, baseURL!);
  await laptop.app.addExpense({ description: 'Czynsz', amount: 2500 });
  await laptop.app.publishNow();

  const phone = await phoneJoining(browser, drive, baseURL!);
  await phone.app.openExpenses();
  await phone.app.expectExpenses(['Czynsz']);

  await laptop.app.removeExpense('Czynsz');
  await laptop.app.publishNow();

  // The phone still holds the record, so a merge that treated its copy as news would
  // bring the expense back — the one outcome a delete must never have.
  await phone.app.reopen();
  await phone.app.expectNoExpense('Czynsz');

  await laptop.app.reopen();
  await laptop.app.expectNoExpense('Czynsz');

  await closeAll(laptop.device, phone.device);
});
