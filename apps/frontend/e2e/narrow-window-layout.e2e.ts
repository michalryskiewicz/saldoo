import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * The guard on the band between a phone and a wide screen.
 *
 * Below `md` the tables become lists and `mobile-layout.e2e.ts` measures the result. Above about
 * 1300px everything fits and nothing is under pressure. In between — a browser window at half a
 * screen, which is where this app is actually used — the table is still a table, the sidebar is
 * still 16rem, and there is not room for both.
 *
 * What that costs is worth naming, because it does not look like a width problem: the sidebar is
 * `position: fixed`, so a page one column too wide scrolls sideways *underneath* it and the
 * sidebar lies on top of the content. The page heading reads as its last two letters and the
 * chart's axis labels are cut in half — a layout that looks smashed rather than one that looks
 * narrow.
 *
 * So two things are measured, and the second is what stops the obvious wrong fix. The page must
 * not scroll sideways, and the table must still be the thing that scrolls: clipping the columns
 * would satisfy the first assertion by making the last column unreachable.
 */

/** A browser window at half a wide screen — and narrow enough that nine columns do not fit. */
const NARROW = { width: 1024, height: 800 };

const SIDEBAR_EXPANDED_WIDTH = 256;

test('the expenses page stays clear of the sidebar in a narrow window', async ({
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
  await app.addExpense({
    description: 'Abonament telefoniczny wraz z pakietem danych',
    amount: 79,
    severity: 'LOW',
    frequency: 'MONTHLY',
  });

  // Resized after the records exist: the create drawer does not settle while the viewport is
  // changing under it.
  await device.page.setViewportSize(NARROW);
  await device.page.reload();
  await app.openExpenses();

  // Expanded by hand, because nothing restores it: `SidebarProvider` is given `defaultOpen={false}`
  // and the cookie it writes is never read back, so every load starts collapsed. Collapsed is the
  // easy case; expanded is the one that broke.
  //
  // Addressed by its slot: the rail carries the same `Toggle Sidebar` name as the header button.
  await device.page.locator('[data-slot="sidebar-trigger"]').click();

  // The sidebar animates its width over 200ms, and every measurement below is a width. Waiting for
  // the value rather than for a duration: `toBeVisible` is true from the first frame of the
  // transition, and a measurement taken then describes a layout that no longer exists.
  await expect(device.page.locator('[data-slot="sidebar-container"]')).toHaveCSS(
    'width',
    `${SIDEBAR_EXPANDED_WIDTH}px`
  );

  const table = device.page.locator('[data-slot="table-container"]').first();
  await expect(table).toBeVisible();

  const overflow = await device.page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    overflow.scrollWidth,
    `the page scrolls sideways by ${overflow.scrollWidth - overflow.clientWidth}px at ${NARROW.width}px, so the fixed sidebar lies on top of the content`
  ).toBeLessThanOrEqual(overflow.clientWidth);

  // The other half of the fix, and the reason the first assertion alone is not enough: a table too
  // wide for the space has to remain reachable. `overflow: hidden` anywhere in the chain would keep
  // the page still and take the last column away with it.
  const frame = await table.evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }));

  expect(
    frame.scrollWidth,
    'the table fits the narrow window, so this test no longer measures anything — widen the table or narrow the viewport'
  ).toBeGreaterThan(frame.clientWidth);

  expect(device.problems()).toEqual([]);

  await device.close();
});
