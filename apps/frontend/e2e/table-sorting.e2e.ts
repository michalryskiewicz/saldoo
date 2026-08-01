import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * Sorting, and the one row that must never take part in it.
 *
 * Both halves were broken and neither was visible from the code. The second click on a heading set
 * "ascending" again instead of reversing, because the handler read the direction when it rendered
 * and the React Compiler had no reason to render it again — the column object it reads from is
 * referentially stable. And the totals row sorted along with the records it totals, so it could
 * land in the middle of them.
 *
 * The total sits in `tfoot` now, so "at the bottom" is a property of the markup rather than
 * something the sort has to be trusted to preserve. Both halves are asserted: that the body
 * reverses, and that the summary was never in the body to be reversed.
 */
test('sorting reverses, and the totals row stays out of the body either way', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  // A reload between the two, because a popover left over from the first form makes the second
  // one's option list unclickable.
  for (const spec of [
    { description: 'Czynsz', amount: 2500 },
    { description: 'Kawa', amount: 111 },
  ]) {
    await app.addExpense(spec);
    await device.page.reload();
    await app.openExpenses();
  }

  await app.sortBy('description');
  expect(await app.rowDescriptions()).toEqual(['Czynsz', 'Kawa']);
  expect(await app.footerLabel()).toBe(pl.expenses_total_yearly);

  await app.sortBy('description');
  expect(await app.rowDescriptions()).toEqual(['Kawa', 'Czynsz']);
  expect(await app.footerLabel()).toBe(pl.expenses_total_yearly);

  await device.close();
});
