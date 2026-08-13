import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * Whether it is growing — for the whole of it.
 *
 * Nothing answered this before: the change column answers it per holding and against that holding's
 * own previous reading, and the only chart with a time axis was the bonds projection.
 */
test('a second valuation draws the line, and the first one cannot', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addPosition({ what: 'Konto', worth: 5000 });

  await app.openHoldingsTab('overview');

  // One reading is a dot. An axis drawn around it would say "flat" about a holding nobody has valued
  // twice, so the card says what to do instead of drawing nothing in silence.
  await expect(device.page.getByText(pl.holdings.growth.empty)).toBeVisible();

  // A pass on a later day gives the line its second point.
  await device.page.getByLabel(pl.holdings.revalue.as_of, { exact: true }).fill('2026-08-28');
  await device.page.getByRole('spinbutton', { name: /— Konto$/ }).fill('5600');
  await device.page.getByRole('button', { name: pl.holdings.revalue.submit }).click();

  await expect(device.page.getByText(pl.holdings.growth.empty)).toBeHidden();

  // And says in words what the line shows, because a shape is not a figure.
  const since = device.page.locator('[data-slot="growth-since"]');
  await expect(since).toContainText('600,00 zł');

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * Filling in the past must not rewrite the present.
 *
 * A position holds the *latest* reading. Somebody reconstructing last spring off a statement is saying
 * what a holding **was** worth — and moving its worth and date backwards would quietly replace today's
 * figure with an old one, which is a worse outcome than having no history at all.
 */
test('a figure said about an earlier day becomes history, not the current worth', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addPosition({ what: 'Konto', worth: 5000 });

  await app.openHoldingsTab('overview');

  // "Back in May it was worth 3 000" — a reading about the past, entered today.
  await device.page.getByLabel(pl.holdings.revalue.as_of, { exact: true }).fill('2026-05-01');
  await device.page.getByRole('spinbutton', { name: /— Konto$/ }).fill('3000');
  await device.page.getByRole('button', { name: pl.holdings.revalue.submit }).click();

  // The holding is still worth what it was worth: the past did not overwrite it.
  await app.openHoldingsTab('untyped');
  const row = device.page.getByRole('row').filter({ hasText: 'Konto' });
  await expect(row.getByText('5000,00 zł').first()).toBeVisible();
  await expect(row.getByText('3000,00 zł')).toBeHidden();

  // And the reading was kept, which is the whole reason for typing it — the line has two points now.
  await app.openHoldingsTab('overview');
  await expect(device.page.getByText(pl.holdings.growth.empty)).toBeHidden();
  await expect(device.page.locator('[data-slot="growth-since"]')).toContainText('2000,00 zł');

  expect(device.problems()).toEqual([]);

  await device.close();
});
