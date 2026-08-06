import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

const amountOf = (text: string) =>
  Number(
    text
      .replace(/−|−/g, '-')
      .replace(/\s/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '')
  );

const addPosition = async (
  app: SaldooApp,
  { what, worth, owed = false }: { what: string; worth: number; owed?: boolean }
) => {
  await app.open('/dashboard/wealth');
  await app.page.getByRole('button', { name: pl.holdings.create, exact: true }).click();

  const sheet = app.page.getByRole('dialog', { name: pl.holdings.create_title });
  await expect(sheet).toBeVisible();

  await sheet.getByLabel(pl.holdings.what, { exact: true }).fill(what);
  if (owed) await sheet.getByRole('radio', { name: pl.holdings.liability, exact: true }).click();
  await sheet.getByLabel(pl.holdings.value, { exact: true }).fill(String(worth));
  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();
};

/**
 * What is held less what is owed, said on the overview.
 *
 * The negative case is asserted deliberately: owing more than you hold is an ordinary situation —
 * most of a mortgage's life is exactly that — and a figure that refuses to print it is not a
 * figure.
 */
test('net worth is what is held less what is owed, and may be negative', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await addPosition(app, { what: 'IKE', worth: 31000 });
  await addPosition(app, { what: 'Konto', worth: 12000 });

  const tile = device.page.locator('[data-slot="net-worth"]');

  await app.openOverview();
  await expect.poll(async () => amountOf((await tile.textContent()) ?? '')).toBe(43000);

  await addPosition(app, { what: 'Kredyt', worth: 60000, owed: true });

  await app.openOverview();
  await expect.poll(async () => amountOf((await tile.textContent()) ?? '')).toBe(-17000);

  // It survived the vault, not just the render.
  await device.page.reload();
  await app.openOverview();
  await expect.poll(async () => amountOf((await tile.textContent()) ?? '')).toBe(-17000);

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * A goal is not a position and must never be added to one. A goal's saved total is what was
 * declared; a position's value is what the thing is worth, and for anything invested those differ
 * by the returns.
 */
test('money put towards a goal does not become net worth', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await addPosition(app, { what: 'Konto', worth: 10000 });
  await app.addGoal({ description: 'IKE', target: 30000, deadlineDayOfMonth: 15 });
  await app.putAside('IKE', 2500);

  await app.openOverview();

  const tile = device.page.locator('[data-slot="net-worth"]');
  await expect.poll(async () => amountOf((await tile.textContent()) ?? '')).toBe(10000);

  expect(device.problems()).toEqual([]);

  await device.close();
});
