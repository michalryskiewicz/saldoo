import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import { ingStatement } from './support/bank-statement.ts';

/**
 * Records kept in złoty, read in euro.
 *
 * The ordinary state of an account that was set up in one country and is being read from another,
 * and the state every one of these screens got wrong: the figure was the złoty figure and the sign
 * over it said euro. Four times the money, silently.
 *
 * A rate is only ever asked for from a screen that asks for one, which is what makes these worth
 * running against the real screens rather than the converter — the converter was never the thing
 * that failed. Two of these screens never asked at all.
 */

test('a goal entered in złoty reads in euro before a single contribution', async ({
  browser,
  baseURL,
}) => {
  // No contribution on purpose. The rates were fetched over the window the *contributions* fall
  // in, so an account that had put nothing aside yet asked for no window at all and converted
  // nothing — the one screen where doing nothing was enough to break it.
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addGoal({ description: 'Wakacje', target: 8000, deadlineDayOfMonth: 15 });

  await app.openAccount();
  await app.chooseCurrency('EUR');
  await app.submitAccountSettings();
  await app.expectSavedNotice();

  await app.openGoals();

  const holiday = device.page.locator('[data-slot="card"]').filter({ hasText: 'Wakacje' });
  await expect(holiday).toBeVisible();

  // The stub prices a euro at 4.5 złoty, so 8000 zł is 1777,78 €. Asserted as present rather than
  // counted: how many times the card repeats the figure is its layout's business, and changes the
  // day a line is added to it. Whether the figure was converted at all is this test's business.
  await expect(holiday.getByText('1777,78 €').first()).toBeVisible();

  // Beside it on purpose: the figure moving is not the whole claim. 8000,00 € is the bug written
  // out — the złoty number wearing the euro sign — and it is what the screen printed.
  await expect(holiday.getByText('8000,00 €')).toBeHidden();

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * A converted figure says that it was converted.
 *
 * The column heading used to carry the whole claim, and carried it for every row — including rows
 * already in the currency and rows nothing could convert, neither of which was converted at all.
 * The mark belongs on the figure that earned it, and it names what it came from: a reader cannot
 * check a rate they were never shown.
 */
test('a converted amount is marked, and says what it was converted from', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addExpense({ description: 'Prąd', amount: 45, frequency: 'MONTHLY' });

  await app.openAccount();
  await app.chooseCurrency('EUR');
  await app.submitAccountSettings();
  await app.expectSavedNotice();

  await app.openExpenses();

  const row = device.page.getByRole('row').filter({ hasText: 'Prąd' });

  // 45 zł at the stub's 4.5 is 10 €, and the figure carries a mark rather than the heading
  // claiming it on every row's behalf.
  await expect(row.getByText('10,00 €').first()).toBeVisible();

  const mark = row.locator('[data-slot="converted"]').first();
  await expect(mark).toBeVisible();
  // `\s` rather than a space: Intl separates the amount from the currency with a non-breaking one,
  // and a literal space would fail on formatting rather than on the mark being wrong.
  await expect(mark).toHaveAttribute('title', /45,00\s*zł/);

  expect(device.problems()).toEqual([]);

  await device.close();
});

/** Every row złoty, the account reading euro. */
const STATEMENT = [
  { date: '2026-07-02', title: 'Czynsz - wspólnota mieszkaniowa', amount: -2500 },
  { date: '2026-07-03', title: 'BIEDRONKA 1234 WARSZAWA', amount: -213.47 },
  { date: '2026-07-09', title: 'Przelew przychodzacy - wynagrodzenie', amount: 12500 },
];

test('a statement keeps its own money in the rows and totals in one currency', async ({
  browser,
  baseURL,
}) => {
  // The screen fetched no rates whatsoever, and its total added every row up regardless of what it
  // was written in, signing the result with whichever currency reached row one.
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.importTransactions(ingStatement(STATEMENT));

  await app.openAccount();
  await app.chooseCurrency('EUR');
  await app.submitAccountSettings();
  await app.expectSavedNotice();

  await app.openTransactions();

  // The bank wrote złoty and the rows still say so — a statement read back in another currency is
  // no longer the statement.
  await expect(device.page.getByText('-2500,00 zł')).toBeVisible();

  // The figure underneath is the one that has to be a single currency to be a total at all.
  await expect(device.page.getByText('2777,78 €')).toBeVisible();
  await expect(device.page.getByText('-603,00 €')).toBeVisible();

  expect(device.problems()).toEqual([]);

  await device.close();
});
