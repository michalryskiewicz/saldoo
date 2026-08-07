import { expect, test, type Page } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

const amountOf = (text: string) =>
  Number(text.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));

/**
 * A holding entered the way the app asks for it: a month, a series, a count. Everything else —
 * the nominal, whether the interest compounds, how often, and the rate — comes from the catalogue,
 * so a test that had to type any of them would be testing a form this app no longer has.
 */
const addBond = async (page: Page, { series, quantity }: { series: string; quantity: string }) => {
  await page.getByRole('button', { name: pl.bonds.create, exact: true }).click();

  const sheet = page.getByRole('dialog', { name: pl.bonds.create_title });
  await expect(sheet).toBeVisible();

  await sheet.getByRole('combobox', { name: pl.bonds.series }).click();
  await page.getByRole('option', { name: new RegExp(`^${series}`) }).click();
  await sheet.getByLabel(pl.bonds.quantity, { exact: true }).fill(quantity);
  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();

  await expect(sheet).toBeHidden();
};

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
  await addBond(device.page, { series: 'EDO', quantity: '100' });

  // Named by the app, from the month and the series: a ten-year bought this month is redeemed ten
  // years from this month, and that is what the Ministry calls it.
  await expect(device.page.getByText(/^EDO\d{4}$/)).toBeVisible();

  await app.openOverview();
  const tile = device.page.locator('[data-slot="net-worth"]');
  // The month it was bought in is not over, so nothing has accrued and the holding is worth exactly
  // what was paid — which is the honest answer on day one.
  await expect.poll(async () => amountOf((await tile.textContent()) ?? '')).toBe(10000);

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * The chart, measured through its axis rather than looked at.
 *
 * A projection is the one thing here that cannot be checked by reading a figure off a row: it is a
 * curve about days that have not happened. What can be checked is the range the axis had to open up
 * to fit it — a chart plotting only what the bond is worth today would top out at ten thousand.
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
  await addBond(device.page, { series: 'EDO', quantity: '100' });

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

  // Ten years of the catalogue's EDO rate on 10 000 compounds well past 16 000, so the axis has to
  // open up to it. A chart drawing only today's worth would stop at 10 000 — the bug this catches.
  expect(highest).toBeGreaterThanOrEqual(16000);
  // And an axis in the hundreds of thousands would mean the arithmetic ran per month, or the stack
  // counted the capital twice.
  expect(highest).toBeLessThan(30000);

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * A purchase from years back, which is where the catalogue used to run out.
 *
 * Picking a month whose offer had never been read left the series list empty and the form asking
 * for a rate — a dead end reached by choosing a perfectly ordinary month. Now every month the
 * picker offers can be priced, and the list is what was really on sale then: ROR, DOR and TOS did
 * not exist in 2019.
 */
test('a bond bought years ago is priced from that month\'s offer', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.open('/dashboard/wealth');
  await device.page.getByRole('button', { name: pl.bonds.create, exact: true }).click();

  const sheet = device.page.getByRole('dialog', { name: pl.bonds.create_title });
  await sheet.getByRole('combobox', { name: pl.bonds.month }).click();
  await device.page.getByRole('option', { name: 'Marzec 2019', exact: true }).click();

  await sheet.getByRole('combobox', { name: pl.bonds.series }).click();

  // What was on sale in March 2019, and nothing else.
  await expect(device.page.getByRole('option', { name: /^EDO/ })).toBeVisible();
  await expect(device.page.getByRole('option', { name: /^ROR/ })).toHaveCount(0);
  await expect(device.page.getByRole('option', { name: /^TOS/ })).toHaveCount(0);

  // The rate of that month, filled in rather than asked for: EDO carried 2.70% in March 2019.
  await expect(device.page.getByRole('option', { name: /^EDO/ })).toContainText('2,70%');

  await device.page.getByRole('option', { name: /^EDO/ }).click();
  await expect(sheet.getByLabel(pl.bonds.rate, { exact: true })).toBeHidden();

  await sheet.getByLabel(pl.bonds.quantity, { exact: true }).fill('20');
  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();

  // Named for the month it is redeemed: a ten-year bought in March 2019 is EDO0329.
  await expect(device.page.getByText('EDO0329')).toBeVisible();

  expect(device.problems()).toEqual([]);

  await device.close();
});
