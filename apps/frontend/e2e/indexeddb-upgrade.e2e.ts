import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { DOCUMENT_FILE, PASSPHRASE } from './support/fixtures.ts';
import { seedLegacyDatabase, serveSeedPage } from './support/legacy-database.ts';

/**
 * An existing install meeting a newer app.
 *
 * Two upgrades happen at once here and both are one-way: Dexie moves the database from
 * version 1 to version 3, and `migrateFromDexie` lifts the rows out of Dexie into the
 * document, after which Dexie is only a projection. A mistake in either loses records
 * that exist on exactly one machine.
 */
test('an old-shaped database is upgraded and its records reach the document', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await serveSeedPage(device.context);
  await seedLegacyDatabase(device.page, {
    expenses: [
      {
        id: 'legacy-1',
        createdAt: new Date('2025-06-01T10:00:00.000Z'),
        description: 'Stary czynsz',
        expense: 1800,
        currency: 'PLN',
        severity: 'HIGH',
        execution: new Date('2025-06-05T00:00:00.000Z'),
      },
    ],
  });

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();
  await app.openExpenses();

  // Survived the schema upgrade: still on screen, from a database written before the tags
  // and settings stores existed.
  await app.expectExpenses(['Stary czynsz']);

  // And survived the move to the document, which is what makes it reach another device at
  // all — before this migration these rows were invisible to the sync.
  await app.waitUntilSynced();
  expect(drive.contents(DOCUMENT_FILE)).not.toBeNull();
  expect(drive.contents(DOCUMENT_FILE)).not.toContain('Stary czynsz');

  // A second device is the only honest proof the record left this machine.
  const joining = await openDevice(browser, { drive, baseURL: baseURL! });
  const joiningApp = new SaldooApp(joining.page);
  await joiningApp.open();
  await joiningApp.unlock(PASSPHRASE);
  await joiningApp.openExpenses();
  await joiningApp.expectExpenses(['Stary czynsz']);

  expect(device.problems()).toEqual([]);

  await device.close();
  await joining.close();
});
