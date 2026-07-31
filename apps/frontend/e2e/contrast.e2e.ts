import { expect, test } from '@playwright/test';
import { createFakeDrive } from './support/fake-drive.ts';
import { openDevice } from './support/device.ts';
import { SaldooApp } from './support/app.ts';
import { PASSPHRASE } from './support/fixtures.ts';

/**
 * Contrast, in both themes, as a standing check rather than a one-off audit.
 *
 * Dark mode is not a filter over light mode: the same hue that reads as confident on white
 * turns unreadable on a dark card. Every token pair below is a decision someone made, and
 * this is what stops the next one being made by accident.
 */

/** Normal text, WCAG 2.1 AA. */
const TEXT_MINIMUM = 4.5;
/** Non-text UI — the severity dots carry meaning by colour alone and nothing else. */
const GRAPHIC_MINIMUM = 3;

type Pair = { name: string; foreground: string; background: string; minimum: number };

const PAIRS: Pair[] = [
  { name: 'body text', foreground: '--foreground', background: '--background', minimum: TEXT_MINIMUM },
  { name: 'card text', foreground: '--card-foreground', background: '--card', minimum: TEXT_MINIMUM },
  {
    name: 'secondary text',
    foreground: '--muted-foreground',
    background: '--background',
    minimum: TEXT_MINIMUM,
  },
  {
    name: 'text on primary',
    foreground: '--primary-foreground',
    background: '--primary',
    minimum: TEXT_MINIMUM,
  },
  { name: 'sidebar text', foreground: '--sidebar-foreground', background: '--sidebar', minimum: TEXT_MINIMUM },
  // Read as text: `text-positive` on a card, `text-warning` for a caution line, `text-info`
  // for an action, `text-destructive` for an error.
  { name: 'positive figure', foreground: '--positive', background: '--card', minimum: TEXT_MINIMUM },
  { name: 'warning line', foreground: '--warning', background: '--card', minimum: TEXT_MINIMUM },
  { name: 'action link', foreground: '--info', background: '--card', minimum: TEXT_MINIMUM },
  { name: 'error text', foreground: '--destructive', background: '--card', minimum: TEXT_MINIMUM },
  // Colour is the *only* thing distinguishing these, so they answer to the graphic rule.
  { name: 'severity low dot', foreground: '--severity-low', background: '--card', minimum: GRAPHIC_MINIMUM },
  {
    name: 'severity medium dot',
    foreground: '--severity-medium',
    background: '--card',
    minimum: GRAPHIC_MINIMUM,
  },
  { name: 'severity high dot', foreground: '--severity-high', background: '--card', minimum: GRAPHIC_MINIMUM },
];

function channelLuminance(value: number): number {
  const scaled = value / 255;

  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const luminance = ([r, g, b]: [number, number, number]) =>
    0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);

  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Resolves each token to sRGB by painting it.
 *
 * The tokens are `oklch`, and a canvas makes the browser do that conversion — which is both
 * the correct one and the one the user's screen will actually perform.
 */
async function resolveTokens(page: import('@playwright/test').Page, tokens: string[]) {
  return page.evaluate((names) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const styles = getComputedStyle(document.documentElement);

    const resolved: Record<string, [number, number, number]> = {};

    for (const name of names) {
      const declared = styles.getPropertyValue(name).trim();

      context.clearRect(0, 0, 1, 1);
      context.fillStyle = declared;
      context.fillRect(0, 0, 1, 1);

      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      resolved[name] = [r, g, b];
    }

    return resolved;
  }, tokens);
}

for (const theme of ['light', 'dark'] as const) {
  test(`every colour pair meets its contrast minimum in the ${theme} theme`, async ({
    browser,
    baseURL,
  }) => {
    const drive = createFakeDrive();
    const device = await openDevice(browser, { drive, baseURL: baseURL! });
    const app = new SaldooApp(device.page);

    await app.open();
    await app.createVault(PASSPHRASE);
    await app.completeOnboarding();
    await app.chooseTheme(theme);

    const tokens = [...new Set(PAIRS.flatMap((pair) => [pair.foreground, pair.background]))];
    const resolved = await resolveTokens(device.page, tokens);

    // Every pair in one go, so a run reports all of them rather than the first.
    const failures = PAIRS.map((pair) => ({
      pair,
      ratio: contrastRatio(resolved[pair.foreground], resolved[pair.background]),
    }))
      .filter(({ pair, ratio }) => ratio < pair.minimum)
      .map(({ pair, ratio }) => `${pair.name}: ${ratio.toFixed(2)}:1, needs ${pair.minimum}:1`);

    expect(failures).toEqual([]);

    await device.close();
  });
}
