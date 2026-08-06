import { expect, test, type Page } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

const PHONE = { width: 390, height: 844 };

const amountOf = (text: string) =>
  Number(
    text
      .replace(/\s/g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '')
  );

/**
 * Declaring money aside and watching both figures move.
 *
 * The bar and the number above it are the whole of release 1 — the release exists to find out
 * whether any of this is worth ticking, and a bar that does not move answers no by default.
 */
test('a goal takes contributions, and both the bar and the total move', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addGoal({ description: 'Wakacje', target: 8000, deadlineDayOfMonth: 15 });

  const total = device.page.locator('[data-slot="total-put-aside"]');
  await expect.poll(async () => amountOf((await total.textContent()) ?? '')).toBe(0);

  await app.putAside('Wakacje', 2000);

  await expect.poll(async () => amountOf((await total.textContent()) ?? '')).toBe(2000);

  // And on the goal's own card, scoped there on purpose: the figure appears twice and that it
  // appears in both places is the point — one screen, one event, two readings that agree.
  const holiday = device.page.locator('[data-slot="card"]').filter({ hasText: 'Wakacje' });
  await expect(holiday.getByText('2000,00 zł')).toBeVisible();
  await expect(holiday.getByText('8000,00 zł')).toBeVisible();

  // A stock, not a streak: a second month adds to it and nothing takes it away.
  await app.putAside('Wakacje', 500);
  await expect.poll(async () => amountOf((await total.textContent()) ?? '')).toBe(2500);

  // It survived the vault, not just the render.
  await device.page.reload();
  await app.openGoals();
  await expect.poll(async () => amountOf((await total.textContent()) ?? '')).toBe(2500);

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * The emergency fund is a goal and is not "put aside". A holiday fund is not a safety net, and
 * counting them as one number makes both of them lie.
 */
test('the emergency fund has a computed target and stays out of the total', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addExpense({ description: 'Czynsz', amount: 1000, frequency: 'MONTHLY' });
  await app.addGoal({ emergencyFund: { coverageMonths: 3, monthlyPace: 500 } });

  await app.openGoals();

  // Three months of a monthly 1 000 with the 10% the fund carries, worked out rather than typed.
  await expect(device.page.getByText('3300,00 zł')).toBeVisible();

  await app.putAside(pl.goal.emergency_fund, 500);

  const total = device.page.locator('[data-slot="total-put-aside"]');
  await expect.poll(async () => amountOf((await total.textContent()) ?? '')).toBe(0);

  expect(device.problems()).toEqual([]);

  await device.close();
});

/** The guard the vault screens taught us to write: measured against the card, not the page. */
test('the goals screen fits a phone', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();
  await app.addGoal({ description: 'Remont', target: 40000, deadlineDayOfMonth: 15 });

  await device.page.setViewportSize(PHONE);
  await device.page.reload();
  await app.openGoals();

  await expectControlsFitTheirCards(device.page);

  expect(device.problems()).toEqual([]);

  await device.close();
});

const expectControlsFitTheirCards = async (page: Page) => {
  const cards = await page.locator('[data-slot="card"]').all();

  expect(cards.length).toBeGreaterThan(0);

  for (const card of cards) {
    const box = (await card.boundingBox())!;

    for (const control of await card.locator('button, input').all()) {
      const inner = (await control.boundingBox())!;
      const name = (await control.textContent()) || 'a control';

      expect(
        Math.round(inner.x + inner.width),
        `"${name.trim()}" is laid past the right edge of its card`
      ).toBeLessThanOrEqual(Math.round(box.x + box.width));
    }
  }
};
