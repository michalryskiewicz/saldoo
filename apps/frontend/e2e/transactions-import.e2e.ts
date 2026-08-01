import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import { ingStatement } from './support/bank-statement.ts';

/**
 * Uploading a statement, which is the only way transactions ever enter this app.
 *
 * It has to be a browser test and it has to run under the shipped Content-Security-Policy,
 * because that is what broke it: the parser was handed `worker: true`, Papa builds its worker
 * from a `blob:` URL, and the policy — which sets no `worker-src` and so falls back to
 * `script-src 'self'` — refused it. Nothing was stored and nothing was said, since the
 * `complete` callback that reports success *and* failure is inside the worker that never
 * started. A unit test could not have seen it: there is no policy in jsdom and no worker
 * either.
 */

const STATEMENT = [
  { date: '2026-07-02', title: 'Czynsz - wspólnota mieszkaniowa', amount: -2500 },
  { date: '2026-07-03', title: 'BIEDRONKA 1234 WARSZAWA', amount: -213.47 },
  { date: '2026-07-09', title: 'Przelew przychodzacy - wynagrodzenie', amount: 12500 },
];

test('a statement upload puts its rows in the table', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.importTransactions(ingStatement(STATEMENT));

  for (const entry of STATEMENT) {
    await expect(device.page.getByText(entry.title)).toBeVisible();
  }

  // The policy violation the worker used to trigger is reported to the console and nowhere
  // else, so a run that stored nothing looked exactly like a run that stored everything.
  expect(device.problems()).toEqual([]);

  await device.close();
});

/**
 * The same file twice.
 *
 * A statement is imported more than once in real use — the month is re-downloaded, or the
 * upload is repeated because it appeared to do nothing. Every row is already keyed by a hash
 * of its contents, so the second upload should change nothing at all.
 */
test('uploading the same statement twice adds nothing the second time', async ({
  browser,
  baseURL,
}) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await app.importTransactions(ingStatement(STATEMENT));
  await app.importTransactions(ingStatement(STATEMENT));

  for (const entry of STATEMENT) {
    await expect(device.page.getByText(entry.title)).toHaveCount(1);
  }

  await device.close();
});
