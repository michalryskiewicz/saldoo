import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * Not a test — a camera. Seeds a plausible account and photographs the wealth section so somebody can
 * look at the whole thing at once, which is the one thing nobody had done while it was being built.
 *
 * Skipped by default for the same reason `shots.e2e.ts` is: it asserts nothing, so a suite that ran it
 * would be spending time to produce files nobody reads.
 */
test.skip(!process.env.SHOTS, 'set SHOTS=1 to take them');

test('a look at the finished wealth section', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  await device.page.setViewportSize({ width: 1440, height: 1000 });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  // A spread somebody might plausibly hold: a flat, an ETF, a savings account, gold, and a mortgage.
  await app.addPosition({ what: 'Mieszkanie', worth: 620000, assetType: 'REAL_ESTATE' });
  await app.addPosition({ what: 'VWCE', worth: 48000, assetType: 'ETF' });
  await app.addPosition({ what: 'Konto oszczędnościowe', worth: 35000, assetType: 'SAVINGS_ACCOUNT' });
  await app.addPosition({ what: 'Złoto', worth: 12000, assetType: 'PRECIOUS_METALS' });
  await app.addPosition({ what: 'Kredyt hipoteczny', worth: 410000, owed: true });

  // A second pass so the line has somewhere to go.
  await app.openHoldingsTab('overview');
  await device.page.getByLabel(pl.holdings.revalue.as_of, { exact: true }).fill('2026-08-28');
  await device.page.getByRole('spinbutton', { name: /— VWCE$/ }).fill('51000');
  await device.page.getByRole('spinbutton', { name: /— Złoto$/ }).fill('12800');
  await device.page.getByRole('button', { name: pl.holdings.revalue.submit }).click();
  // Waited for, or navigating away cancels the writes mid-flight — which is exactly what happened the
  // first time these shots were taken, and the growth card came out empty.
  await expect(device.page.getByText(pl.holdings.revalue.saved_few.replace('{{count}}', '2'))).toBeVisible();

  // A target, so the allocation has something to measure against.
  await app.openAccount();
  await app.setAllocationTarget({ REAL_ESTATE: 60, ETF: 25, SAVINGS_ACCOUNT: 10, PRECIOUS_METALS: 5 });
  await app.submitAccountSettings();
  await app.expectSavedNotice();

  await app.openHoldingsTab('overview');
  await device.page.waitForTimeout(1200);
  await device.page.screenshot({ path: 'final-look/1-overview.png', fullPage: true });

  await app.openHoldingsTab('ETF');
  await device.page.waitForTimeout(400);
  await device.page.screenshot({ path: 'final-look/2-etf.png', fullPage: true });

  await app.openHoldingsTab('owed');
  await device.page.waitForTimeout(400);
  await device.page.screenshot({ path: 'final-look/3-owed.png', fullPage: true });

  await app.openOverview();
  await device.page.waitForTimeout(1200);
  await device.page.screenshot({ path: 'final-look/4-dashboard-tile.png', fullPage: false });

  await device.close();
});
