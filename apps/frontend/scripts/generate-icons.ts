import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/**
 * Draws the home-screen icons from `public/logo.svg`.
 *
 * A generator rather than four checked-in images nobody can reproduce: the mark, the tile colour
 * and the padding all come from one place, so changing the logo is one command rather than an
 * afternoon in an image editor. The images *are* committed — a build must not depend on a browser
 * being installed — and this script is how they are regenerated.
 *
 * Rendered in Chromium because the repo already has one, and because nothing else here can
 * rasterise an SVG. `sips` cannot read SVG and macOS has no other converter installed by default.
 *
 * Run with `bun run icons` from `apps/frontend`.
 */

const HERE = dirname(new URL(import.meta.url).pathname);
const PUBLIC_DIR = resolve(HERE, '../public');
const ICON_DIR = resolve(PUBLIC_DIR, 'icons');

/**
 * The tile the app already draws behind the mark in the sidebar — `--sidebar-primary` and
 * `--sidebar-primary-foreground` of the light theme, resolved out of oklch. An icon that does not
 * match the thing it opens is a different app as far as the eye is concerned.
 */
const TILE = '#101828';
const MARK = '#f9fafb';

type Icon = {
  file: string;
  size: number;
  /**
   * How much of the tile the mark's own bounding box fills.
   *
   * The sidebar draws it at 6/8 of its tile, which is where `0.72` comes from. A maskable icon is
   * cropped to an unknown shape by the platform, and only the middle 80% is guaranteed to survive
   * — so its mark is shrunk to sit inside that circle rather than being cropped by it.
   */
  glyph: number;
};

const ICONS: Icon[] = [
  { file: 'icon-192.png', size: 192, glyph: 0.72 },
  { file: 'icon-512.png', size: 512, glyph: 0.72 },
  { file: 'icon-maskable-512.png', size: 512, glyph: 0.56 },
  // iOS rounds the corners itself and composites onto black, so this one is square and opaque.
  { file: 'apple-touch-icon.png', size: 180, glyph: 0.72 },
];

const page = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 1 });

  return { browser, page: await context.newPage() };
};

const document = (svg: string, { size, glyph }: Icon) => `
  <style>
    html, body { margin: 0; }
    body {
      width: ${size}px;
      height: ${size}px;
      background: ${TILE};
      display: flex;
      align-items: center;
      justify-content: center;
    }
    svg { width: ${size * glyph}px; height: ${size * glyph}px; display: block; }
    svg path { fill: ${MARK}; }
  </style>
  ${svg}
`;

/**
 * Retargets the `viewBox` onto the mark's own bounding box, squared and centred.
 *
 * Without this the padding is a lie: the artwork sits in a 1024 square but the mark only occupies
 * about half its width, so an icon sized by the `viewBox` comes out small and off-centre, and the
 * maskable safe area cannot be reasoned about at all.
 */
const fitViewBoxToMark = () => {
  const svg = window.document.querySelector('svg')!;
  const box = svg.getBBox();
  const side = Math.max(box.width, box.height);

  svg.setAttribute(
    'viewBox',
    [box.x - (side - box.width) / 2, box.y - (side - box.height) / 2, side, side].join(' ')
  );
};

const svg = await readFile(resolve(PUBLIC_DIR, 'logo.svg'), 'utf8');
await mkdir(ICON_DIR, { recursive: true });

const { browser, page: canvas } = await page();

for (const icon of ICONS) {
  await canvas.setViewportSize({ width: icon.size, height: icon.size });
  await canvas.setContent(document(svg, icon));
  await canvas.evaluate(fitViewBoxToMark);
  await canvas.screenshot({ path: resolve(ICON_DIR, icon.file) });

  console.log(`${icon.file}  ${icon.size}x${icon.size}  mark at ${icon.glyph * 100}%`);
}

await browser.close();
