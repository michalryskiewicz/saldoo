import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * What somebody's wealth is made of, and how far that is from what they planned.
 *
 * The reading two people with the same net worth need in order to see they are not in remotely the
 * same position. The share is the fact; the amount is not.
 */
test('the wealth splits by kind, and says how far that is from the target', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addPosition({ what: 'Konto', worth: 2500, assetType: 'SAVINGS_ACCOUNT' });
  await app.addPosition({ what: 'VWCE', worth: 7500, assetType: 'ETF' });

  await app.openHoldingsTab('overview');

  const table = device.page.locator('[data-slot="allocation"]');
  await expect(table).toBeVisible();

  // Three quarters to one, before anybody has said what they meant it to be.
  const etf = device.page.locator('[data-slot="allocation-ETF"]');
  await expect(etf).toContainText('75%');
  await expect(etf).toContainText('7500,00 zł');

  // No target set, so there is no distance to report and the row says so rather than inventing one.
  await expect(etf).toContainText('—');

  // Now the person says what they meant: sixty in ETFs, forty in the savings account.
  await app.openAccount();
  await app.setAllocationTarget({ ETF: 60, SAVINGS_ACCOUNT: 40 });
  await app.submitAccountSettings();
  await app.expectSavedNotice();

  await app.openHoldingsTab('overview');

  // Fifteen points over where it was meant to be — said in words, because a bare "15" leaves the
  // reader working out which way it points and against which unit.
  await expect(device.page.locator('[data-slot="allocation-ETF"]')).toContainText(
    pl.holdings.allocation.over.replace('{{points}}', '15')
  );
  await expect(device.page.locator('[data-slot="allocation-SAVINGS_ACCOUNT"]')).toContainText(
    pl.holdings.allocation.under.replace('{{points}}', '15')
  );

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * And what it refuses to fold in.
 *
 * A holding nobody has said the kind of is left out of the shares and reported beside them. Counted
 * in, every kind would read as far below its target for a reason that is bookkeeping rather than a
 * position; left out in silence, the percentages would describe part of somebody's money as if it
 * were all of it.
 */
test('a holding with no kind is reported rather than counted', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addPosition({ what: 'VWCE', worth: 7500, assetType: 'ETF' });
  await app.addPosition({ what: 'Coś jeszcze', worth: 5000 });

  await app.openHoldingsTab('overview');

  // The typed holding is the whole of the split, and the untyped one is named underneath it.
  await expect(device.page.locator('[data-slot="allocation-ETF"]')).toContainText('100%');

  const untyped = device.page.locator('[data-slot="allocation-untyped"]');
  await expect(untyped).toBeVisible();
  await expect(untyped).toContainText('5000,00 zł');

  expect(device.problems()).toEqual([]);

  await device.close();
});
