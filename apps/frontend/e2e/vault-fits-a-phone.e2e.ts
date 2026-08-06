import { expect, test, type Page } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';
import pl from '../src/locales/pl.json' with { type: 'json' };

/**
 * The guard the vault screens never had.
 *
 * `mobile-layout.e2e.ts` holds the pages behind the lock and none of the three in front of it —
 * which are the ones every user meets first, and the only ones a user who cannot get past them
 * ever sees. A control laid past the edge of its card is not visibly broken in a screenshot and
 * does not scroll the page, so it is measured rather than looked at.
 */

const PHONE = { width: 390, height: 844 };

/**
 * Every control on the screen, measured against the card it is supposed to sit inside.
 *
 * Not the page's sideways scroll, which is the obvious instrument and the wrong one: the card
 * clips whatever hangs off it, so the page stays exactly as wide as the phone while the password
 * field and both buttons run off the right-hand edge. `mobile-layout.e2e.ts` already learned this
 * against a badge in a transaction row — the only honest question is where an element's right
 * edge is, not whether the document scrolls.
 */
const expectFits = async (page: Page, screen: string) => {
  const card = (await page.locator('[data-slot="card"]').boundingBox())!;
  const controls = await page.locator('[data-slot="card-content"] input, [data-slot="card-content"] button').all();

  expect(controls.length, `${screen} has no controls to measure`).toBeGreaterThan(0);

  for (const control of controls) {
    const box = (await control.boundingBox())!;
    const name = (await control.textContent()) || (await control.getAttribute('id')) || 'a control';

    expect(
      Math.round(box.x + box.width),
      `${screen}: "${name.trim()}" is laid past the right edge of its card`
    ).toBeLessThanOrEqual(Math.round(card.x + card.width));

    expect(
      Math.round(box.x),
      `${screen}: "${name.trim()}" starts left of its card`
    ).toBeGreaterThanOrEqual(Math.round(card.x));
  }
};

test('the vault screens fit a phone', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await device.page.setViewportSize(PHONE);
  await app.open();

  // Setting one up, which is the first thing anybody sees.
  await expect(device.page.locator('#vault-passphrase')).toBeVisible();
  await expectFits(device.page, 'the vault setup screen');

  // The recovery code, which is the long unbroken string of the three.
  await device.page.locator('#vault-passphrase').fill(PASSPHRASE);
  await device.page.locator('#vault-passphrase-confirm').fill(PASSPHRASE);
  await device.page.getByRole('button', { name: pl.vault.create_button }).click();
  await expect(device.page.locator('#recovery-code-saved')).toBeVisible();
  await expectFits(device.page, 'the recovery code screen');

  // And unlocking, which is the one a returning user meets every time. A reload does not reach it
  // — the session key survives F5 on purpose — so it takes a second context, whose IndexedDB and
  // session have never held the data key.
  await device.page.locator('#recovery-code-saved').click();
  await device.page.getByRole('button', { name: pl.vault.recovery_continue }).click();
  await app.completeOnboarding();
  await app.openExpenses();
  await app.publishNow();

  const returning = await openDevice(browser, { drive, baseURL: baseURL! });
  const returningApp = new SaldooApp(returning.page);

  await returning.page.setViewportSize(PHONE);
  await returningApp.open();
  await returningApp.expectAsksForPassphrase();
  await expectFits(returning.page, 'the vault unlock screen');

  expect(device.problems()).toEqual([]);
  expect(returning.problems()).toEqual([]);

  await returning.close();
  await device.close();
});
