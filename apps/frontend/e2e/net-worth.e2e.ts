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

/**
 * The two sides as one picture, measured rather than looked at.
 *
 * A stacked bar is easy to get subtly wrong in ways a screenshot forgives: a segment left out, a
 * side stacked onto the wrong bar, a total that no longer matches the figure printed above it. What
 * is asserted here is the arithmetic the picture claims — every block accounted for, and the
 * balance equal to the difference of the two bars.
 */
test('the wealth page draws what is held against what is owed', async ({ browser, baseURL }) => {
  const drive = createFakeDrive();
  const device = await openDevice(browser, { drive, baseURL: baseURL! });
  const app = new SaldooApp(device.page);

  await app.open();
  await app.createVault(PASSPHRASE);
  await app.completeOnboarding();

  await addPosition(app, { what: 'Mieszkanie', worth: 640000 });
  await addPosition(app, { what: 'Konto osobiste', worth: 18400 });
  await addPosition(app, { what: 'Kredyt hipoteczny', worth: 410000, owed: true });

  await app.open('/dashboard/wealth');

  // Both sides are named on the axis, or the bars are two lengths of nothing in particular.
  //
  // Scoped to the axis, because Recharts keeps a hidden span of the same text for measuring — and
  // compared without whitespace, because it breaks a two-word tick into separate `tspan`s when the
  // label is tight. Where that break falls depends on the font metrics of the machine drawing it:
  // "Jesteś winien" stayed on one line here and arrived as "Jesteświnien" on CI.
  const withoutSpaces = (text: string) => text.replace(/\s/gu, '');
  const axis = device.page.locator('.recharts-yAxis');

  await expect
    .poll(async () => withoutSpaces((await axis.textContent()) ?? ''))
    .toContain(withoutSpaces(pl.holdings.held));
  await expect
    .poll(async () => withoutSpaces((await axis.textContent()) ?? ''))
    .toContain(withoutSpaces(pl.holdings.owed));

  // 640 000 + 18 400 held, 410 000 owed.
  const total = device.page.locator('[data-slot="net-worth-total"]');
  await expect.poll(async () => amountOf((await total.textContent()) ?? '')).toBe(248400);

  // One block per thing, on the right bar: two held and one owed. Counted by width, because every
  // series is drawn on every bar and the ones that do not belong there come out zero wide — so the
  // plain count is always series times bars and says nothing about where anything landed.
  await expect
    .poll(async () =>
      device.page.evaluate(
        () =>
          [...document.querySelectorAll('.recharts-bar-rectangle path')].filter(
            (block) => block.getBoundingClientRect().width >= 1
          ).length
      )
    )
    .toBe(3);

  expect(device.problems()).toEqual([]);

  await device.close();
});
