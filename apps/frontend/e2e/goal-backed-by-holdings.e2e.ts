import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

const amountOf = (text: string) =>
  Number(text.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));

/**
 * The join this app did not have: a goal that reads what is actually held against it.
 *
 * Everything here already existed separately and could not see the other side — a bond that knows
 * what it is worth, a fund that knows what it needs, and no way to say that the first is the second.
 * The figure being asserted is one nobody typed: the bond prices itself, the goal reads the share
 * pointed at it, and the two meet without a single "put aside" being declared.
 */
test('a bond assigned to the emergency fund becomes the fund', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.addExpense({ description: 'Czynsz', amount: 1000, frequency: 'MONTHLY' });

  // A fund that reads its holdings rather than its declarations.
  await app.openGoals();
  await device.page.getByRole('button', { name: pl.goal.create, exact: true }).click();
  const sheet = device.page.getByRole('dialog', { name: pl.goal.create_title });
  await sheet.getByRole('radio', { name: pl.goal.kind_fund, exact: true }).click();
  await sheet.getByRole('radio', { name: pl.goal.months_3, exact: true }).click();
  await sheet.getByLabel(pl.goal.monthly_pace, { exact: true }).fill('500');
  await sheet.getByRole('radio', { name: pl.goal.funding_holdings, exact: true }).click();
  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(sheet).toBeHidden();

  // Nothing points at it yet, so it is honestly empty rather than quietly zero.
  const card = device.page
    .locator('[data-slot="card"]')
    .filter({ hasText: pl.goal.emergency_fund });
  await expect(card.locator('[data-slot="metric-value"]')).toContainText('0,00 zł');

  // A holding, and what it is for, said where the holding is edited.
  await app.open('/dashboard/wealth');
  await device.page.getByRole('button', { name: pl.holdings.create, exact: true }).click();
  const holding = device.page.getByRole('dialog', { name: pl.holdings.create_title });
  await holding.getByLabel(pl.holdings.what, { exact: true }).fill('Konto oszczędnościowe');
  await holding.getByLabel(pl.holdings.value, { exact: true }).fill('2000');
  await holding.getByLabel(pl.holdings.assigned_to, { exact: true }).click();
  await device.page.getByRole('option', { name: pl.goal.emergency_fund }).click();
  await holding.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(holding).toBeHidden();

  await app.openGoals();

  // 2 000 of the 3 300 three months of a 1 000 rent needs — read off the account, declared nowhere.
  await expect
    .poll(async () => amountOf((await card.locator('[data-slot="metric-value"]').textContent()) ?? ''), {
      timeout: 15_000,
    })
    .toBe(2000);

  await expect(card.locator('[data-slot="goal-backing"]')).toContainText('Konto oszczędnościowe');

  expect(device.problems()).toEqual([]);

  await device.close();
});
