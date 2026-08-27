import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * A bank Saldoo ships no parser for.
 *
 * The point of the universal mapper is that this file is ordinary — a header, three columns, a
 * comma for a decimal point — and yet nothing in the app knows it. Somebody says which column is
 * which, once, and from then on it is the same kind of thing as ING.
 */
const UNKNOWN_STATEMENT = Buffer.from(
  [
    'Wyciąg z rachunku',
    'Data;Opis;Kwota',
    '04.03.2026;BIEDRONKA 1234;-213,47',
    '05.03.2026;Wynagrodzenie;12 500,00',
    '',
  ].join('\r\n'),
  'utf-8'
);

const chooseColumn = async (page: import('@playwright/test').Page, field: string, column: string) => {
  await page.getByRole('combobox', { name: field }).click();
  await page.getByRole('option', { name: column, exact: true }).click();
};

test('a bank we ship no parser for is described once and then imported', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.openTransactions();
  await device.page.getByRole('button', { name: pl.create_transactions }).click();

  const sheet = device.page.getByRole('dialog', { name: pl.add_transactions });
  await sheet.locator('#file-input').setInputFiles({
    name: 'wyciag.csv',
    mimeType: 'text/csv',
    buffer: UNKNOWN_STATEMENT,
  });

  // Nothing recognises it, and saying so is what opens the mapper.
  await expect(sheet.getByTestId('import-detection')).toHaveText(pl.statement.unknown);
  await expect(sheet.getByTestId('statement-mapping')).toBeVisible();

  // The header is chosen by clicking the row that names the columns, which then names the selects.
  await sheet.getByTestId('preview-row-1').click();

  await chooseColumn(device.page, pl.statement.mapping.date, 'Data');
  await chooseColumn(device.page, pl.statement.mapping.description_column, 'Opis');
  await chooseColumn(device.page, pl.statement.mapping.amount, 'Kwota');

  await sheet.getByLabel(pl.statement.mapping.name).fill('Mój bank');

  // Said before anything is stored: the mapping run against the real file, as it is described.
  await expect(sheet.getByTestId('mapping-reads')).toHaveText(
    pl.statement.mapping.reads.replace('{{count}}', '2')
  );

  await sheet.getByRole('button', { name: pl.statement.mapping.save }).click();

  await expect(sheet.getByTestId('import-detection')).toHaveText(
    pl.statement.using.replace('{{name}}', 'Mój bank')
  );

  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(device.page.getByText(pl.success['upload-transaction']).first()).toBeVisible();
  await device.page.keyboard.press('Escape');

  await expect(device.page.getByText('BIEDRONKA 1234')).toBeVisible();
  await expect(device.page.getByText('Wynagrodzenie')).toBeVisible();

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * The month after.
 *
 * A saved mapping keeps the header it was described against, so the next export from the same bank
 * is recognised the way ING is — which is the difference between describing a format once and
 * describing it every month.
 */
test('the format described last month recognises this month by itself', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.openTransactions();
  await device.page.getByRole('button', { name: pl.create_transactions }).click();

  const sheet = device.page.getByRole('dialog', { name: pl.add_transactions });
  await sheet.locator('#file-input').setInputFiles({
    name: 'marzec.csv',
    mimeType: 'text/csv',
    buffer: UNKNOWN_STATEMENT,
  });

  await sheet.getByTestId('preview-row-1').click();
  await chooseColumn(device.page, pl.statement.mapping.date, 'Data');
  await chooseColumn(device.page, pl.statement.mapping.description_column, 'Opis');
  await chooseColumn(device.page, pl.statement.mapping.amount, 'Kwota');
  await sheet.getByLabel(pl.statement.mapping.name).fill('Mój bank');
  await sheet.getByRole('button', { name: pl.statement.mapping.save }).click();
  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(device.page.getByText(pl.success['upload-transaction']).first()).toBeVisible();

  // April, same bank, same shape, one payment nobody has seen before.
  const nextMonth = Buffer.from(
    [
      'Wyciąg z rachunku',
      'Data;Opis;Kwota',
      '04.04.2026;ORLEN STACJA 55;-310,00',
      '',
    ].join('\r\n'),
    'utf-8'
  );

  await sheet.locator('#file-input').setInputFiles({
    name: 'kwiecien.csv',
    mimeType: 'text/csv',
    buffer: nextMonth,
  });

  await expect(sheet.getByTestId('import-detection')).toHaveText(
    pl.statement.detected.replace('{{bank}}', 'Mój bank')
  );

  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();
  await expect(device.page.getByText(pl.success['upload-transaction']).first()).toBeVisible();
  await device.page.keyboard.press('Escape');

  await expect(device.page.getByText('ORLEN STACJA 55')).toBeVisible();

  await device.close();
});
