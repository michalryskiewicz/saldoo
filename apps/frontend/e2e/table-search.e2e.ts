import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * Searching a table by words that are on the screen but not in the data.
 *
 * The priority is stored as `HIGH` and read as "Wysoki", so a search over the stored values would
 * find nothing for every word a person can actually see — which is the whole reason the search box
 * replaced the priority pills rather than sitting beside them. Only a browser can answer whether
 * the rendered words are reachable.
 *
 * It also pins the summary to what is on the screen: a total that goes on reporting the sum of
 * everything while the rows are filtered is a figure answering a question nobody asked.
 */
test('searching finds a row by its priority, and the total follows the rows', async ({
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
    { description: 'Czynsz', amount: 2500, severity: 'HIGH' as const },
    { description: 'Kawa', amount: 100, severity: 'LOW' as const },
  ]) {
    await app.addExpense(spec);
    await device.page.reload();
    await app.openExpenses();
  }

  // Sorted here, and only here: this test is about which rows survive a search, not about the
  // order an unsorted table happens to hand them back in.
  expect((await app.rowDescriptions()).sort()).toEqual(['Czynsz', 'Kawa']);

  // "Wysoki" is nowhere in either description; it is what HIGH is rendered as.
  await app.searchFor('wysoki');
  expect(await app.rowDescriptions()).toEqual(['Czynsz']);
  expect(await app.footerTotal()).toContain('2500');

  // Typed without its diacritics, the way somebody in a hurry types.
  await app.searchFor('czynsz');
  expect(await app.rowDescriptions()).toEqual(['Czynsz']);

  await app.searchFor('nie ma takiego wydatku');
  await app.expectNothingMatches('nie ma takiego wydatku');

  await app.clearSearch();
  expect((await app.rowDescriptions()).sort()).toEqual(['Czynsz', 'Kawa']);
  expect(await app.footerTotal()).toContain('2600');

  expect(device.problems()).toEqual([]);

  await device.close();
});
