import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The guard on the home-screen tile.
 *
 * Everything here is a string pointing at a file, and a string pointing at nothing fails silently:
 * a renamed icon does not break a build, does not log, and does not show up on the machine the
 * rename happened on. It shows up as a blank or generic tile on somebody's phone, weeks later,
 * with no way to tell whether the icon was never there or the install went wrong.
 *
 * The dimension check is the half that earns its place twice over: `sizes: "512x512"` beside a file
 * that is actually 192 pixels is accepted by the manifest, upscaled by the platform, and looks like
 * a low-effort app rather than like a bug.
 */

// The vitest root, which is this package. Not `import.meta.url`: Vite rewrites it to a `/@fs/`
// path, and every `resolve` off it lands somewhere that does not exist.
const FRONTEND = process.cwd();
const PUBLIC_DIR = resolve(FRONTEND, 'public');

type ManifestIcon = { src: string; sizes: string; type: string; purpose?: string };
type Manifest = {
  name: string;
  start_url: string;
  scope: string;
  display: string;
  icons: ManifestIcon[];
};

const manifest = JSON.parse(
  readFileSync(resolve(PUBLIC_DIR, 'manifest.webmanifest'), 'utf8')
) as Manifest;

const html = readFileSync(resolve(FRONTEND, 'index.html'), 'utf8');

/**
 * A PNG's real dimensions, read out of its IHDR chunk: the 8-byte signature, a 4-byte length and
 * the four bytes of the chunk name, then width and height as big-endian 32-bit integers.
 */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);

  expect(bytes.subarray(12, 16).toString('ascii'), `${path} is not a PNG`).toBe('IHDR');

  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const publicFile = (src: string) => resolve(PUBLIC_DIR, src.replace(/^\//, ''));

describe('the manifest', () => {
  it('asks for a standalone window from its own scope', () => {
    // Without `standalone` the tile opens a Safari tab with an address bar, which is a bookmark
    // with extra steps rather than an installed app.
    expect(manifest.display).toBe('standalone');
    expect(manifest.scope).toBe('/');
    // The root, not a screen: which screen somebody belongs on is a question about their vault and
    // their sign-in, and the app's own routing is the only thing that can answer it.
    expect(manifest.start_url).toBe('/');
  });

  it('names an icon at every size a platform asks for', () => {
    const sizes = manifest.icons.map((icon) => icon.sizes);

    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('offers a maskable icon, so the mark is not cropped into by a platform shape', () => {
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  it.each(
    // Named per case, or a failure says "1 of 3" about a file it will not name.
    ((): [string, ManifestIcon][] => manifest.icons.map((icon) => [icon.src, icon]))()
  )('has %s on disk, at the size it claims', (_src, icon) => {
    const [width, height] = icon.sizes.split('x').map(Number);

    expect(pngSize(publicFile(icon.src))).toEqual({ width, height });
  });
});

describe('the document', () => {
  it('links the manifest', () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
  });

  it('links an apple-touch-icon that exists, at the size iOS draws', () => {
    const link = html.match(/rel="apple-touch-icon"\s+href="([^"]+)"/);

    expect(link, 'iOS ignores the manifest icons for the home-screen tile').not.toBeNull();

    // 180 is what iOS asks for at 3x. A smaller file is upscaled and a larger one is not sharper.
    expect(pngSize(publicFile(link![1]))).toEqual({ width: 180, height: 180 });
  });

  it('declares itself capable under both the standard and the Apple-prefixed name', () => {
    expect(html).toContain('name="mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
  });
});
