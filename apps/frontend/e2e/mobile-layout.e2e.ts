import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

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
  await expect(row.getByText('1980,00 zł')).toBeVisible();
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
