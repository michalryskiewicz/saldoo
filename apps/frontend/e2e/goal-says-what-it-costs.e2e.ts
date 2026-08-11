import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * A goal card states its consequence, and the two figures it quotes are the ones the overview
 * quotes back.
 *
 * The screen was a register: every figure correct, none of them saying what it does to anything
 * else. What it costs the month is the same rule the leading figure subtracts, so a test that
 * reads the sentence here and the tile there is the only place the two can be caught disagreeing.
 */
test('a goal says what it takes from this month, and the overview takes exactly that', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addProfit({ description: 'Faktura klient A', amount: 10000, frequency: 'MONTHLY' });
  await app.addGoal({
    description: 'Wakacje',
    target: 8000,
    deadlineDayOfMonth: 15,
    strategyPart: 'SAVINGS',
  });

  const card = device.page.locator('[data-slot="card"]').filter({ hasText: 'Wakacje' });
  const consequence = card.locator('[data-slot="goal-consequence"]');

  // Wanted this month, so the whole 8 000 is what it asks for — and it says which tile that moves.
  await expect(consequence).toContainText('8000,00 zł');
  await expect(consequence).toContainText(pl.SAVINGS);

  // The same figure, one screen over: 10 000 planned income less the 8 000 the goal claims.
  await app.expectFreeThisMonth(2000);

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * The seam somebody hits the first time they put money aside and watch net worth not move. It is
 * deliberate — a declaration is not a holding, and for anything invested the two differ by the
 * returns — so the app has to say so and offer the way across.
 */
test('a goal explains that putting money aside is not net worth, and opens the way to record it', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addGoal({
    description: 'IKE',
    target: 30000,
    deadlineDayOfMonth: 15,
    strategyPart: 'SAVINGS',
  });
  await app.putAside('IKE', 2500);

  const card = device.page.locator('[data-slot="card"]').filter({ hasText: 'IKE' });
  await expect(card.locator('[data-slot="goal-consequence"]')).toContainText(pl.goal.not_wealth);

  await card.getByRole('button', { name: `${pl.goal.add_to_wealth} — IKE` }).click();

  // On the holdings screen, which is where the position will live — a form that writes to a
  // screen nobody was taken to leaves somebody unsure anything happened.
  await expect(device.page).toHaveURL(/\/dashboard\/wealth$/);

  // Prefilled from the goal and every field left editable: what was declared and what the holding
  // is worth are different numbers, and the app refuses to decide the difference.
  const drawer = device.page.getByRole('dialog', { name: pl.holdings.create_title });
  await expect(drawer.getByLabel(pl.holdings.what, { exact: true })).toHaveValue('IKE');
  await expect(drawer.getByLabel(pl.holdings.value, { exact: true })).toHaveValue('2500');

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * The fund is the one goal set in months, so it is read back in months — and the sentence names
 * the thing that moves its target, which is the person's own costs rather than anything they did.
 */
test('the emergency fund says how long it would last and what its target follows', async ({
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
  await app.putAside(pl.goal.emergency_fund, 1800);

  const card = device.page
    .locator('[data-slot="card"]')
    .filter({ hasText: pl.goal.emergency_fund });
  const consequence = card.locator('[data-slot="goal-consequence"]');

  // Three months of a monthly 1 000 plus the 10% the fund carries: 3 300, of which 1 800 is 1.6
  // months of living.
  await expect(consequence).toContainText('3300,00 zł');
  await expect(consequence).toContainText('1,6');

  expect(device.problems()).toEqual([]);

  await device.close();
});
