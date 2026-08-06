import { expect, test } from '@playwright/test';
import pl from '../src/locales/pl.json' with { type: 'json' };
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * What the app says when changes stop reaching Drive.
 *
 * The state this covers is the dangerous one because it looks like working: the app is
 * responsive, the records are saved locally, and nothing is going anywhere. It used to be
 * announced by a small red glyph in the header.
 *
 * Driven by a Drive that refuses uploads — a harness capability added for this, since the
 * app's behaviour for a refusal was previously impossible to observe from outside.
 */
test('a Drive that refuses uploads is announced, with the one action that fixes it', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  // Online, signed in, holding a fresh token — every reason to believe things are fine.
  drive.refuseUploads(403);
  await app.openExpenses();
  await app.addExpense({ description: 'Czynsz', amount: 2500, frequency: 'MONTHLY' });

  const banner = device.page.getByRole('alert').filter({ hasText: pl.sync.alert_failed });

  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(banner.getByRole('button', { name: pl.sync.alert_reconnect })).toBeVisible();

  await device.close();
});

test('a Drive that is behaving says nothing at all', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();
  await app.openExpenses();
  await app.addExpense({ description: 'Kawa', amount: 14.99, survivesIncomeLoss: false, frequency: 'DAILY' });
  await app.waitUntilSynced();

  // The guard against a banner that cries wolf: it must be absent on the ordinary path,
  // or it stops meaning anything on the day it appears.
  await expect(device.page.getByRole('alert')).toHaveCount(0);

  await device.close();
});
