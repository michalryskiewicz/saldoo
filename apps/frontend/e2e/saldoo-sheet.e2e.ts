import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import { ingStatement } from './support/bank-statement.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * The round trip: our own file out, edited in a spreadsheet, and the same file back.
 *
 * A browser test because every part of it is a thing no unit test has. The file is written by a
 * blob the page creates and saved by the browser under the shipped Content-Security-Policy; it comes
 * back through the real file field, is recognised by detection rather than by being told, and the
 * write path it reaches is the only one in the app that updates and deletes. What is asserted at the
 * end is the transactions table — because "the category changed" is only true if the screen says so.
 */

const STATEMENT = [
  { date: '2026-07-02', title: 'Czynsz - wspolnota mieszkaniowa', amount: -2500 },
  { date: '2026-07-03', title: 'BIEDRONKA 1234 WARSZAWA', amount: -213.47 },
  { date: '2026-07-09', title: 'Przelew przychodzacy - wynagrodzenie', amount: 12500 },
];

/** One of the categories onboarding fills in, so the sheet can name something that exists. */
const CATEGORY = 'ZDROWIE';

/** The columns of our own format, in the order it writes them. */
const COLUMN = { category: 5, delete: 9 } as const;

/**
 * Edits one cell of one row, the way somebody would in Excel.
 *
 * A plain split on the delimiter, which holds because none of these descriptions contains one — a
 * quoted cell would need a parser, and a test that parsed the file to edit it would be asserting
 * against its own reading rather than against the file.
 */
const editCell = (csv: string, description: string, column: number, value: string): string =>
  csv
    .split(/\r?\n/)
    .map((line) => {
      if (!line.includes(description)) return line;

      const cells = line.split(';');
      cells[column] = value;

      return cells.join(';');
    })
    .join('\r\n');

const downloadSheet = async (page: Page): Promise<string> => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-sheet').click(),
  ]);

  const path = await download.path();

  return readFile(path, 'utf8');
};

/** Uploads a file into the import drawer and submits it, leaving the report on screen. */
const uploadSheet = async (page: Page, csv: string) => {
  await page.getByRole('button', { name: pl.create_transactions }).click();

  const sheet = page.getByRole('dialog', { name: pl.add_transactions });

  await sheet
    .locator('#file-input')
    .setInputFiles({ name: 'saldoo.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });

  // Nothing is chosen by hand: our own header is either found intact or this is not our file.
  await expect(sheet.getByTestId('import-detection')).toHaveText(
    pl.statement.detected.replace('{{bank}}', 'Saldoo')
  );

  await sheet.getByRole('button', { name: pl.submit, exact: true }).click();

  return sheet;
};

const withImportedStatement = async (browser: Parameters<typeof openDevice>[0], baseURL: string) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();
  await app.importTransactions(ingStatement(STATEMENT));

  return { drive, device, app };
};

test('re-importing an untouched export changes nothing, and says so', async ({ browser, baseURL }) => {
  const { device, app } = await withImportedStatement(browser, baseURL!);

  await app.openTransactions();
  const csv = await downloadSheet(device.page);

  const sheet = await uploadSheet(device.page, csv);
  const report = sheet.getByTestId('import-report');

  // Every row named a record we hold and asked for nothing. Stated plainly rather than as a
  // problem: it is the file working exactly as intended.
  await expect(report).toContainText(pl.statement.report.imported.replace('{{count}}', '0'));
  await expect(report).toContainText(
    pl.statement.report.duplicates.replace('{{count}}', String(STATEMENT.length))
  );

  await device.page.keyboard.press('Escape');

  for (const entry of STATEMENT) {
    await expect(device.page.getByText(entry.title)).toHaveCount(1);
  }

  expect(device.problems()).toEqual([]);

  await device.close();
});

test('a category set in the spreadsheet lands on the payment it names', async ({ browser, baseURL }) => {
  const { device, app } = await withImportedStatement(browser, baseURL!);

  await app.openTransactions();
  const exported = await downloadSheet(device.page);

  const edited = editCell(exported, STATEMENT[1].title, COLUMN.category, CATEGORY);

  const sheet = await uploadSheet(device.page, edited);
  const report = sheet.getByTestId('import-report');

  await expect(report).toContainText(pl.statement.report.updated.replace('{{count}}', '1'));
  // The two rows nobody touched are held, not written again.
  await expect(report).toContainText(pl.statement.report.duplicates.replace('{{count}}', '2'));

  await device.page.keyboard.press('Escape');

  // The screen is the assertion: the badge is what a filed payment looks like to the person.
  const row = device.page.getByRole('row').filter({ hasText: STATEMENT[1].title });
  await expect(row.getByText(CATEGORY)).toBeVisible();

  // And nothing else moved — the whole point of matching on the id.
  const untouched = device.page.getByRole('row').filter({ hasText: STATEMENT[0].title });
  await expect(untouched.getByText(CATEGORY)).toHaveCount(0);

  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * The delete column, on two devices sharing one Drive folder.
 *
 * The assertion that cannot be made anywhere else: a row removed by the sheet has to *stay* removed
 * on the other device. Deleting it out of Dexie alone would look identical here and be wrong there —
 * the record would arrive back from the next device to sync, which is the failure ADR-0001 exists
 * for and the reason the write path goes through `documentSession.remove`.
 */
test('a row marked for deletion is gone on the other device too', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();

  const laptop = await openDevice(browser, { drive, baseURL: baseURL! });
  const laptopApp = new SaldooApp(laptop.page);

  await laptopApp.open();
  await laptopApp.createVault(PASSPHRASE);
  await laptopApp.completeOnboarding();
  await laptopApp.importTransactions(ingStatement(STATEMENT));
  await laptopApp.openTransactions();
  await laptopApp.publishNow();

  const phone = await openDevice(browser, { drive, baseURL: baseURL! });
  const phoneApp = new SaldooApp(phone.page);

  await phoneApp.open();
  await phoneApp.expectAsksForPassphrase();
  await phoneApp.unlock(PASSPHRASE);

  // Settling on the page it is already on before going anywhere: unlocking is in flight, and
  // navigating over it throws the unlock away and asks for the passphrase again.
  await phoneApp.openExpenses();
  await phoneApp.openTransactions();
  await expect(phone.page.getByText(STATEMENT[1].title)).toBeVisible();

  await laptopApp.openTransactions();
  const exported = await downloadSheet(laptop.page);
  const marked = editCell(exported, STATEMENT[1].title, COLUMN.delete, 'x');

  const sheet = await uploadSheet(laptop.page, marked);
  await expect(sheet.getByTestId('import-report')).toContainText(
    pl.statement.report.deleted.replace('{{count}}', '1')
  );

  await laptop.page.keyboard.press('Escape');
  await expect(laptop.page.getByText(STATEMENT[1].title)).toHaveCount(0);
  // The rows the file did not mark are untouched: absence never deletes.
  await expect(laptop.page.getByText(STATEMENT[0].title)).toBeVisible();

  await laptopApp.publishNow();
  await phoneApp.reopen();
  await phoneApp.openTransactions();

  await expect(phone.page.getByText(STATEMENT[1].title)).toHaveCount(0);
  await expect(phone.page.getByText(STATEMENT[0].title)).toBeVisible();

  await laptop.close();
  await phone.close();
});
