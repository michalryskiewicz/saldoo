import { test, type Route } from '@playwright/test';
import pl from '../src/locales/pl.json' with { type: 'json' };
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

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

      // Waited for a bar to exist *before* waiting out the animation. The chart's data arrives
      // from IndexedDB after the page is otherwise ready, so counting the animation from
      // page-ready is counting from the wrong moment — and a shot taken then shows an empty plot
      // area, which reads as a chart with no data.
      await device.page.locator('.recharts-bar-rectangle').first().waitFor();
      await device.page.waitForTimeout(CHART_ANIMATION_MS);

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
