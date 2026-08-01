import { expect, test, type Page, type Route } from '@playwright/test';
import pl from '../src/locales/pl.json' with { type: 'json' };
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import { ingStatement, type StatementEntry } from './support/bank-statement.ts';

/**
 * Not a test — a camera. It asserts nothing and is skipped unless asked for:
 *
 * ```bash
 * SHOTS=1 bun run e2e --grep shots
 * ```
 *
 * It is committed rather than written from scratch each time because judging this app's UI by
 * reading its code does not work. Three defects shipped past review that one look would have
 * caught: sorting that never reversed, filters sitting outside the frame they belonged to, and a
 * money heading ignoring its column's alignment. Every one was invisible in the diff and obvious
 * in a screenshot.
 *
 * Output lands in `shots/`, which is gitignored — the images are for looking at now, not a
 * baseline to diff against. Visual regression would need stable data and a stable renderer, and
 * this has neither.
 */

const VIEWPORTS = {
  // A laptop, and the narrowest phone worth designing for.
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

/**
 * Recharts animates its bars in over 1500ms from zero height. A shot taken before that elapses
 * shows an empty plot area, which reads as a broken chart and is not one.
 */
const CHART_ANIMATION_MS = 1_800;

/**
 * Waits until the bars stop growing, rather than waiting out a number.
 *
 * The animation is not the only thing that decides when a chart is finished: the exchange rates
 * arrive from the network after the records arrive from IndexedDB, and the figures change when
 * they land — so the bars start again from zero partway through any fixed wait. Which is how
 * the profits chart was photographed as an empty plot area at one width and a full one at the
 * other, from the same data.
 */
const waitForBarsToSettle = async (page: Page) => {
  const bars = page.locator('.recharts-bar-rectangle');
  await bars.first().waitFor();

  let previous = -1;
  await expect
    .poll(
      async () => {
        const height = (await bars.first().boundingBox())?.height ?? -1;
        const settled = height > 0 && height === previous;
        previous = height;
        return settled;
      },
      { timeout: 15_000, intervals: [200] }
    )
    .toBe(true);
};

const EXPENSES_ROUTE = '/dashboard/expenses';
const dutiesLabel = pl.duties;

/** Enough variety for colour, alignment and column width to be judgeable at a glance. */
const EXPENSES = [
  { description: 'Czynsz', amount: 2500, severity: 'HIGH', frequency: 'MONTHLY' },
  { description: 'Abonament telefon', amount: 65, severity: 'LOW', frequency: 'MONTHLY' },
  { description: 'Zakupy spożywcze', amount: 480.5, severity: 'MEDIUM', frequency: 'WEEKLY' },
  { description: 'Ubezpieczenie samochodu', amount: 1980, severity: 'MEDIUM', frequency: 'YEARLY' },
  { description: 'Kawa', amount: 14.99, severity: 'LOW', frequency: 'DAILY' },
] as const;

test.skip(!process.env.SHOTS, 'Set SHOTS=1 to take screenshots.');

test('shots: the expenses page in both themes and both widths', async ({ browser, baseURL }) => {
  // Filling the create form five times, twice as many reloads, then eight screenshots.
  test.setTimeout(240_000);

  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  // A reload between each: a popover left over from the previous form makes the next one's
  // option list unclickable.
  for (const expense of EXPENSES) {
    await app.addExpense(expense);
    await device.page.reload();
    await app.openExpenses();
  }

  for (const theme of ['light', 'dark'] as const) {
    // Chosen before the resize, and always at desktop width: the header control this drives is
    // the one place the theme can be set, and it has less room to be reached on a phone.
    await device.page.setViewportSize(VIEWPORTS.desktop);
    await app.chooseTheme(theme);

    // Reloaded rather than blurred. The theme survives in storage, and a fresh document is the
    // only reliable way to be rid of the focus ring the menu hands back to its trigger as it
    // closes -- blurring races Radix restoring it, and a shot with a ring on a header button has
    // twice read as a styling defect that was only ever the harness's own last click.
    await device.page.reload();
    await app.openExpenses();

    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      await device.page.setViewportSize(viewport);

      await waitForBarsToSettle(device.page);

      await device.page.screenshot({
        path: `shots/expenses-${name}-${theme}.png`,
        fullPage: true,
      });
    }

    // And the create form, which is a screen of its own and cannot be judged from the page behind
    // it. Desktop width: the drawer is where the two-column pairing shows at all.
    await device.page.setViewportSize(VIEWPORTS.desktop);
    await app.openCreateForm();
    // The viewport, not the full page: the drawer is `position: fixed`, and a full-page capture
    // walks the document flow and leaves it out of the image entirely.
    await device.page.screenshot({ path: `shots/expense-form-${theme}.png` });
    await app.closeCreateForm();
  }

  await device.close();
});

test('shots: the duties page in both themes and both widths', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);

  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  for (const expense of EXPENSES) {
    await app.addExpense(expense);
    await device.page.reload();
    await app.openExpenses();
  }

  // One of each state, because the tones are the point: a due row at full strength, a paid one
  // quietened, a skipped one struck out. A table of nothing but unpaid rows shows a third of
  // what there is to judge.
  await app.openDuties();
  await app.markDutyPaid('Czynsz');
  await app.skipDuty('Ubezpieczenie samochodu');

  for (const theme of ['light', 'dark'] as const) {
    await device.page.setViewportSize(VIEWPORTS.desktop);
    await app.chooseTheme(theme);

    // Reloaded for the same reason the expenses shots are: it is the only reliable way to be rid
    // of the focus ring the theme menu hands back to its trigger.
    await device.page.reload();
    await app.openDuties();

    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      await device.page.setViewportSize(viewport);

      // Rows arrive from IndexedDB after the page is otherwise ready, and below `md` the table
      // is not a table at all — so wait for the record itself rather than for a `tr`.
      await device.page.getByText('Czynsz').first().waitFor();

      await device.page.screenshot({
        path: `shots/duties-${name}-${theme}.png`,
        fullPage: true,
      });
    }
  }

  await device.close();
});

/** Enough rows for a total, a spread across categories, and a heatmap with something in it. */
const PROFITS = [
  { description: 'Wynagrodzenie', amount: 12500, frequency: 'MONTHLY' },
  { description: 'Zlecenie — strona internetowa', amount: 3200, frequency: 'YEARLY' },
  { description: 'Odsetki z lokaty', amount: 84.2, frequency: 'MONTHLY' },
] as const;

/**
 * A day of this month, as the bank writes it.
 *
 * Relative to today rather than fixed: the month filter and the heatmap both read the calendar,
 * and a statement from a year ago photographs an empty screen rather than a full one.
 */
const dayOfThisMonth = (day: number) => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  return `${today.getFullYear()}-${month}-${String(day).padStart(2, '0')}`;
};

const STATEMENT: StatementEntry[] = [
  { date: dayOfThisMonth(2), title: 'Czynsz - wspólnota mieszkaniowa', amount: -2500 },
  { date: dayOfThisMonth(3), title: 'BIEDRONKA 1234 WARSZAWA', amount: -213.47 },
  { date: dayOfThisMonth(5), title: 'Orange Polska - abonament', amount: -65 },
  { date: dayOfThisMonth(8), title: 'GREEN CAFFE NERO', amount: -14.99 },
  { date: dayOfThisMonth(9), title: 'Przelew przychodzacy - wynagrodzenie', amount: 12500 },
  { date: dayOfThisMonth(12), title: 'PZU - składka OC', amount: -1980 },
  { date: dayOfThisMonth(14), title: 'ZABKA Z0123 KRAKÓW', amount: -37.8 },
];

/**
 * The three screens that have not been through the rework the expenses table set the shape of.
 *
 * One test rather than three: the vault, the wizard and the seed data cost far more than the
 * shots do, and all three screens read the same records.
 */
test('shots: the remaining dashboards in both themes and both widths', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(360_000);

  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  // A reload between each: a popover left over from the previous form makes the next one's
  // option list unclickable.
  for (const expense of EXPENSES) {
    await app.addExpense(expense);
    await device.page.reload();
    await app.openExpenses();
  }

  for (const profit of PROFITS) {
    await app.addProfit(profit);
    await device.page.reload();
    await app.openProfits();
  }

  await app.importTransactions(ingStatement(STATEMENT));

  // One payment filed, because an unfiled one shows an empty column: what the merged assignment
  // column looks like *with* something in it is the whole reason it was merged.
  await app.assignTransaction('BIEDRONKA');

  const SCREENS = [
    { name: 'profits', open: () => app.openProfits(), settled: 'Wynagrodzenie', chart: true },
    { name: 'transactions', open: () => app.openTransactions(), settled: 'BIEDRONKA' },
    { name: 'overview', open: () => app.openOverview(), settled: undefined },
  ] as const;

  for (const theme of ['light', 'dark'] as const) {
    await device.page.setViewportSize(VIEWPORTS.desktop);
    await app.chooseTheme(theme);

    // Reloaded for the same reason every other shot is: it is the only reliable way to be rid of
    // the focus ring the theme menu hands back to its trigger.
    await device.page.reload();

    for (const screen of SCREENS) {
      await screen.open();

      for (const [name, viewport] of Object.entries(VIEWPORTS)) {
        await device.page.setViewportSize(viewport);

        // Records arrive from IndexedDB after the page is otherwise ready, and below `md` a table
        // is not a table — so wait for the record itself rather than for a `tr`. The overview has
        // no records to wait for, only charts, so it waits out the animation alone.
        if (screen.settled) await device.page.getByText(screen.settled).first().waitFor();
        if ('chart' in screen) await waitForBarsToSettle(device.page);
        await device.page.waitForTimeout(CHART_ANIMATION_MS);

        await device.page.screenshot({
          path: `shots/${screen.name}-${name}-${theme}.png`,
          fullPage: true,
        });
      }

      // Back to desktop before the next screen: the theme control the loop reaches for next has
      // less room to be found on a phone.
      await device.page.setViewportSize(VIEWPORTS.desktop);
    }
  }

  await device.close();
});

/**
 * The two waits, held open on purpose.
 *
 * Both are built to be missed: nothing is drawn for the first 300ms, and most waits are over by
 * then. So the only way to look at either is to make the thing it waits on slow, which is what
 * the held routes below do — `fallback` hands each request back to the Google stub afterwards.
 */
test('shots: the two loading screens in both themes', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);

  const USERINFO = '**/oauth2/v3/userinfo*';
  const LAZY_CHUNK = '**/assets/*.js';
  /** Long enough to outlast the reveal delay and the shot itself. */
  const HELD_MS = 3_000;
  /** The reveal delay, plus room for the wait to paint. */
  const SETTLE_MS = 1_200;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Registered `times: 1` rather than unrouted afterwards: removing a handler while it still holds
   * a request kills that request, and a failed userinfo call reads to the app as a lost identity —
   * which sent the first attempt at this shot to the sign-in screen instead.
   *
   * Each handler finishes the request itself rather than calling `fallback`: handing a
   * slept-on route back to the Google stub raced it into `Route is already handled`.
   */
  const holdIdentity = async (route: Route) => {
    await sleep(HELD_MS);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sub: 'shots-user', email: 'shots@example.com', name: 'Shots' }),
    });
  };

  const holdChunk = async (route: Route) => {
    await sleep(HELD_MS);
    await route.continue();
  };

  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  for (const theme of ['light', 'dark'] as const) {
    await device.page.setViewportSize(VIEWPORTS.desktop);
    await app.chooseTheme(theme);
    await device.page.reload();
    await app.openExpenses();

    // Identity is what the auth guard waits on, so holding the userinfo answer holds the guard —
    // and the guard is the first of the three gates that used to show a screen each.
    await device.page.route(USERINFO, holdIdentity, { times: 1 });
    await device.page.goto(EXPENSES_ROUTE);
    await device.page.waitForTimeout(SETTLE_MS);
    await device.page.screenshot({ path: `shots/loading-entry-${theme}.png` });

    await app.openExpenses();

    // The other wait lives inside the shell, so it has to be a client-side navigation: a full
    // load would hold the document itself and put us back on the entry screen.
    await device.page.route(LAZY_CHUNK, holdChunk, { times: 1 });
    await device.page.getByRole('link', { name: dutiesLabel }).click();
    await device.page.waitForTimeout(SETTLE_MS);
    await device.page.screenshot({ path: `shots/loading-content-${theme}.png` });
    await app.openDuties();
  }

  await device.close();
});

/**
 * The banner that says changes are not leaving this device.
 *
 * Photographed because it is the one message meant to interrupt, and how loud it reads is
 * the whole design question: too quiet and it is the red glyph it replaces, too loud and
 * it competes with the figures it sits above.
 */
test('shots: the sync banner in both themes', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);

  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  drive.refuseUploads(403);
  await app.openExpenses();
  await app.addExpense({
    description: 'Czynsz',
    amount: 2500,
    severity: 'HIGH',
    frequency: 'MONTHLY',
  });
  await device.page.getByRole('alert').first().waitFor({ timeout: 20_000 });

  for (const theme of ['light', 'dark'] as const) {
    await device.page.setViewportSize(VIEWPORTS.desktop);
    await app.chooseTheme(theme);
    await device.page.getByRole('alert').first().waitFor({ timeout: 20_000 });
    await device.page.screenshot({ path: `shots/sync-banner-${theme}.png` });
  }

  await device.close();
});
