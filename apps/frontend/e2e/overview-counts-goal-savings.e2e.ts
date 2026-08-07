import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * That the overview counts a goal as savings — both what is planned for it and what went in.
 *
 * The arithmetic for this has existed and been unit-tested since goals shipped; what had never
 * been asserted is that the screen asks for it. The overview's hook left the two arguments out,
 * they default to empty, and nothing anywhere went red: the tile reported somebody who had just
 * organised their saving as saving nothing, and the goals screen said the opposite about the same
 * money on the same day.
 *
 * Which is why this is a browser test rather than another unit. The defect was never in the sum —
 * it was in nobody handing it the records, and only the rendered screen can catch that.
 */
test('an amount put aside is savings on the overview, and the goal behind it is what was planned', async ({
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

  // Wanted this month, so what has to go in is the whole remainder rather than an instalment —
  // the one shape whose figure does not depend on the day the suite happens to run.
  // Named rather than taken from the form's default, which is the strategy's first part and for
  // 50-30-20 is "needs". Which part a goal meets is the person's answer, not the app's guess.
  await app.addGoal({
    description: 'Wakacje',
    target: 8000,
    deadlineDayOfMonth: 15,
    strategyPart: 'SAVINGS',
  });
  await app.putAside('Wakacje', 2000);

  await app.expectStrategyPart('SAVINGS', { spent: 2000, planned: 6000 });

  expect(device.problems()).toEqual([]);

  await device.close();
});
