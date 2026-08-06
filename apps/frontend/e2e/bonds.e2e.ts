import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

const amountOf = (text: string) =>
  Number(text.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));

/**
 * Bonds counted at what they are worth, worked out rather than typed.
 *
 * The whole difference between this and a hand-valued position is that nobody has to remember to
 * update it — so the assertion is on a figure the person never entered.
 */
test('treasury bonds are worth what the arithmetic says, and land in net worth', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.open('/dashboard/wealth');
  await device.page.getByRole('button', { name: pl.bonds.create, exact: true }).click();

  const sheet = device.page.getByRole('dialog', { name: pl.bonds.create_title });
  await expect(sheet).toBeVisible();

  await sheet.getByLabel(pl.bonds.series, { exact: true }).fill('EDO0335');
  await sheet.getByLabel(pl.bonds.quantity, { exact: true }).fill('100');
  await sheet.getByLabel(pl.bonds.rate, { exact: true }).fill('6.55');

  // The purchase date is left at today, so nothing has accrued yet and the holding is worth
  // exactly what was paid — which is the honest answer on day one.
  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();

  await expect(device.page.getByText('EDO0335')).toBeVisible();

  await app.openOverview();
  const tile = device.page.locator('[data-slot="net-worth"]');
  await expect.poll(async () => amountOf((await tile.textContent()) ?? '')).toBe(10000);

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * The chart, measured through its axis rather than looked at.
 *
 * A projection is the one thing here that cannot be checked by reading a figure off a row: it is a
 * curve about days that have not happened. What can be checked is the range the axis had to open up
 * to fit it — a chart plotting only what the bond is worth today would top out at ten thousand, and
 * one compounding ten years of 6.55% has to reach past eighteen.
 */
test('the bond chart plots the projection, not just what is held today', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.open('/dashboard/wealth');
  await device.page.getByRole('button', { name: pl.bonds.create, exact: true }).click();

  const sheet = device.page.getByRole('dialog', { name: pl.bonds.create_title });
  await sheet.getByLabel(pl.bonds.series, { exact: true }).fill('EDO0335');
  await sheet.getByLabel(pl.bonds.quantity, { exact: true }).fill('100');
  await sheet.getByLabel(pl.bonds.rate, { exact: true }).fill('6.55');
  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();

  await expect(device.page.getByText(pl.bonds.chart_title)).toBeVisible();

  // Both bands are named, because "what it earned" is only readable if it is told apart from "what
  // was put in".
  const legend = device.page.locator('.recharts-legend-wrapper');
  await expect(legend).toContainText(pl.bonds.capital);
  await expect(legend).toContainText(pl.bonds.interest_earned);

  // The future half is marked as a guess on the chart itself. Exact, or this also matches the word
  // inside the card's description — which would leave it passing with no band drawn at all.
  await expect(device.page.getByText(pl.bonds.projection, { exact: true })).toBeVisible();

  const ticks = device.page.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value');
  await expect.poll(async () => (await ticks.count()) > 0).toBe(true);

  // `textContent`, not `innerText`: an SVG `<text>` has no rendered-text box, so `allInnerTexts`
  // hands back a list of undefined and the parse dies rather than failing an assertion.
  const highest = Math.max(...(await ticks.allTextContents()).map(amountOf));

  // Ten years of 6.55% on 10 000 compounds to 18 859.69, so the axis has to reach past 18 000. A
  // chart drawing only today's worth would stop at 10 000 — which is the bug this catches.
  expect(highest).toBeGreaterThanOrEqual(18000);
  // And an axis in the hundreds of thousands would mean the arithmetic ran per month, or the stack
  // counted the capital twice.
  expect(highest).toBeLessThan(30000);

  expect(device.problems()).toEqual([]);

  await device.close();
});
