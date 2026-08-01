import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import { ingStatement } from './support/bank-statement.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * The guard on the phone layout.
 *
 * Without this the mobile rules rot: they are invisible on the machine they are written on, every
 * new screen is built at desktop width, and the sideways scroll comes back one column at a time
 * with nothing to notice it. This is the equivalent of the contrast suite — a rule the tests hold
 * rather than a rule somebody remembers.
 *
 * Two things are asserted, and the second is the one that actually bites: that the table has become
 * a list, and that **nothing** makes the page scroll sideways. A page a little too wide is not
 * visibly broken in a screenshot, which is exactly why it needs measuring rather than looking at.
 */

const PHONE = { width: 390, height: 844 };

test('the expenses page fits a phone, and the table stops being a table', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addExpense({
    description: 'Ubezpieczenie samochodu na cały rok',
    amount: 1980,
    severity: 'MEDIUM',
    frequency: 'YEARLY',
  });

  // Resized after the record exists: the create drawer does not settle while the viewport is
  // changing under it.
  await device.page.setViewportSize(PHONE);
  await device.page.reload();
  await app.openExpenses();

  // The rows are a list now. A `table` still standing here means the swap did not happen and the
  // eight columns are hiding behind a sideways scroll.
  await expect(device.page.locator('table')).toHaveCount(0);

  const row = device.page.getByRole('listitem').filter({ hasText: 'Ubezpieczenie' });
  await expect(row).toBeVisible();

  // The figure and the priority survive the swap: the number is what the row exists to show, and
  // the priority is the only thing colour says in this table.
  //
  // Addressed by its slot. The figure is what a year of this costs, and the amount as entered is
  // a detail beside it — for a yearly cost those are the same number, so asking for the text
  // finds two elements and answers about whichever is first in the DOM.
  await expect(row.locator('[data-slot="row-figure"]')).toHaveText('1980,00 zł');
  await expect(row.getByText('Średni')).toBeVisible();

  // Addressed by its slot rather than its words: with one expense the summary carries the same
  // figure as the row, and "Całkowita" is also the name of a tab further up the page. That it
  // resolves at all is how we know the summary band survived the swap.
  const summary = device.page.locator('[data-slot="table-summary"]');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('1980,00 zł');

  const overflow = await device.page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    overflow.scrollWidth,
    `page scrolls sideways by ${overflow.scrollWidth - overflow.clientWidth}px at ${PHONE.width}px`
  ).toBeLessThanOrEqual(overflow.clientWidth);

  expect(device.problems()).toEqual([]);

  await device.close();
});

test('the overview fits a phone', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addExpense({ description: 'Czynsz', amount: 2500, frequency: 'MONTHLY' });
  await app.importTransactions(
    ingStatement([{ date: '2026-07-03', title: 'BIEDRONKA 1234 WARSZAWA', amount: -213.47 }])
  );

  await device.page.setViewportSize(PHONE);
  await device.page.reload();
  await app.openOverview();

  // The charts are the whole page here, and a chart is the easiest thing to lay out at a width
  // it was measured at rather than the one it is in: the tile this replaced was drawn at a fixed
  // 1000px inside a scroller, so a phone showed a quarter of it and nothing said so.
  await expect(device.page.getByText(pl.monthly_spending_title)).toBeVisible();

  const overflow = await device.page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    overflow.scrollWidth,
    `page scrolls sideways by ${overflow.scrollWidth - overflow.clientWidth}px at ${PHONE.width}px`
  ).toBeLessThanOrEqual(overflow.clientWidth);

  expect(device.problems()).toEqual([]);

  await device.close();
});

test('the transactions page fits a phone with a payment filed under everything', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addExpense({ description: 'Ubezpieczenie samochodu na cały rok', amount: 1980 });
  await app.importTransactions(
    ingStatement([{ date: '2026-07-03', title: 'BIEDRONKA 1234 WARSZAWA', amount: -213.47 }])
  );
  // Filed under all three, and against an expense with a name long enough to matter: the
  // assignment column holds one badge per filing, and three of them side by side are wider than
  // a phone. What that costs is a badge laid past the edge of its card, which the card clips —
  // so the page does not scroll and nothing looks wrong from the outside.
  await app.assignTransaction('BIEDRONKA');

  await device.page.setViewportSize(PHONE);
  await device.page.reload();
  await app.openTransactions();

  await expect(device.page.locator('table')).toHaveCount(0);

  const row = device.page.getByRole('listitem').filter({ hasText: 'BIEDRONKA' });
  await expect(row).toBeVisible();
  await expect(row.getByText('-213,47 zł')).toBeVisible();

  // Measured, not looked for. A badge laid past the edge of its card is clipped by the card and
  // not by the page, so nothing scrolls sideways and `toBeVisible` goes on answering yes about
  // a word that has been cut in half. The only honest question is where its right edge is.
  const card = (await row.boundingBox())!;
  const lastBadge = (await row.getByText('Ubezpieczenie samochodu na cały rok').boundingBox())!;

  expect(
    Math.round(lastBadge.x + lastBadge.width),
    'the last filing badge is laid past the right edge of its card'
  ).toBeLessThanOrEqual(Math.round(card.x + card.width));

  const overflow = await device.page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    overflow.scrollWidth,
    `page scrolls sideways by ${overflow.scrollWidth - overflow.clientWidth}px at ${PHONE.width}px`
  ).toBeLessThanOrEqual(overflow.clientWidth);

  expect(device.problems()).toEqual([]);

  await device.close();
});

test('the profits page fits a phone, and its summary keeps its figure', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addProfit({ description: 'Wynagrodzenie', amount: 12500, frequency: 'MONTHLY' });

  await device.page.setViewportSize(PHONE);
  await device.page.reload();
  await app.openProfits();

  await expect(device.page.locator('table')).toHaveCount(0);

  const row = device.page.getByRole('listitem').filter({ hasText: 'Wynagrodzenie' });
  await expect(row).toBeVisible();

  // The figure is what a year of this comes to; the amount as entered is a detail beside it.
  await expect(row.locator('[data-slot="row-figure"]')).toHaveText('150 000,00 zł');
  await expect(row.getByText('12 500,00 zł')).toBeVisible();

  // The summary's figure, which is the half of it that carries the answer. Below `md` only the
  // title and the figure are placed, so a money column that never said it was the figure left
  // the band showing a label and nothing else — a total of blank.
  const summary = device.page.locator('[data-slot="table-summary"]');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('150 000,00 zł');

  const overflow = await device.page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    overflow.scrollWidth,
    `page scrolls sideways by ${overflow.scrollWidth - overflow.clientWidth}px at ${PHONE.width}px`
  ).toBeLessThanOrEqual(overflow.clientWidth);

  expect(device.problems()).toEqual([]);

  await device.close();
});
