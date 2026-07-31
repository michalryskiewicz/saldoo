import { test } from '@playwright/test';
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
