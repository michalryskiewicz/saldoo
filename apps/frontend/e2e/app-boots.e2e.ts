import { expect, test } from '@playwright/test';

/**
 * The harness proving itself.
 *
 * Deliberately the first test written: it needs no Google, no Drive and no vault, so
 * when it passes the config, the web server and the CI job are known good — and every
 * later failure is about the app rather than about the plumbing.
 */
test.describe('the app boots', () => {
  test('serves the shell without a console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    // Something rendered: the app mounted rather than leaving an empty root, which is
    // what a failed dynamic import looks like.
    await expect(page.locator('#root')).not.toBeEmpty();

    // A console error here is the class of bug this suite exists to catch — a CSP
    // refusal, a hydration error, a missing module — none of which fails a unit test.
    expect(errors).toEqual([]);
  });

  test('reaches an unauthenticated user’s starting screen rather than hanging', async ({ page }) => {
    await page.goto('/');

    // Without Google the app cannot get past the auth guard, so it either shows the
    // sign-in route or a loader — never a blank page, and never a crash.
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page).toHaveURL(/localhost/);
  });

  test('the legal links under the sign-in checkbox go somewhere', async ({ page }) => {
    await page.goto('/auth/google/sign-in');

    // They used to point at `/docs/terms-and-conditions` and `/docs/privacy-policy`, which
    // no route ever rendered — so the two links under a checkbox nobody can sign in without
    // both landed on the 404 page. The documents live on the marketing site.
    for (const name of [/warunki korzystania/i, /polityka prywatno/i]) {
      const link = page.getByRole('link', { name });

      await expect(link).toHaveAttribute('href', /^https:\/\/saldoo\.io\//);
      // The app is a place someone is mid-task in; reading the terms must not lose that.
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });
});
