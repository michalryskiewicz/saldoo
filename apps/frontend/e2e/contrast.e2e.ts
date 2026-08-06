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
  // The sync banner, which is the one element in the app whose whole job is to be read. It sat on
  // an alpha modifier until #88 and so was invisible here.
  {
    name: 'sync banner text',
    foreground: '--destructive',
    background: '--destructive-surface',
    minimum: TEXT_MINIMUM,
  },
  // Colour is the *only* thing distinguishing these, so they answer to the graphic rule.
  { name: 'severity low dot', foreground: '--severity-low', background: '--card', minimum: GRAPHIC_MINIMUM },
  {
    name: 'severity medium dot',
    foreground: '--severity-medium',
    background: '--card',
    minimum: GRAPHIC_MINIMUM,
  },
  { name: 'severity high dot', foreground: '--severity-high', background: '--card', minimum: GRAPHIC_MINIMUM },
  // The boundary of a control the user has to find — an empty checkbox, an unfocused field.
  // WCAG 1.4.11 asks 3:1 of exactly this, and it is what made the checkboxes look disabled.
  { name: 'control border', foreground: '--input', background: '--background', minimum: GRAPHIC_MINIMUM },
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

type Measured = { name: string; minimum: number; foreground: Rgb; background: Rgb };
type Rgb = [number, number, number];

/**
 * Resolves each pair to the sRGB the screen will actually show.
 *
 * A canvas is used so the browser performs the `oklch` conversion rather than this file
 * approximating it. The foreground is painted **over** the background rather than measured on
 * its own, because several tokens carry alpha — `--border` and `--input` are
 * `oklch(1 0 0 / 10%)` in dark mode — and a translucent colour read off a transparent canvas
 * measures as though it were opaque. That is how a pair can pass here and be invisible on
 * screen.
 */
async function measure(
  page: import('@playwright/test').Page,
  pairs: Pair[]
): Promise<Measured[]> {
  return page.evaluate((declared) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const styles = getComputedStyle(document.documentElement);

    const paint = (colours: string[]): [number, number, number] => {
      context.clearRect(0, 0, 1, 1);
      for (const colour of colours) {
        context.fillStyle = colour;
        context.fillRect(0, 0, 1, 1);
      }
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;

      return [r, g, b];
    };

    return declared.map((pair) => {
      const background = styles.getPropertyValue(pair.background).trim();
      const foreground = styles.getPropertyValue(pair.foreground).trim();

      return {
        name: pair.name,
        minimum: pair.minimum,
        // Opaque white underneath, so a translucent background composites the way the page does.
        background: paint(['#fff', background]),
        foreground: paint(['#fff', background, foreground]),
      };
    });
  }, pairs);
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

    const measured = await measure(device.page, PAIRS);

    // Every pair in one go, so a run reports all of them rather than the first.
    const failures = measured
      .map((pair) => ({ pair, ratio: contrastRatio(pair.foreground, pair.background) }))
      .filter(({ pair, ratio }) => ratio < pair.minimum)
      .map(({ pair, ratio }) => `${pair.name}: ${ratio.toFixed(2)}:1, needs ${pair.minimum}:1`);

    expect(failures).toEqual([]);

    await device.close();
  });
}
