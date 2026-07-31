import { describe, expect, it } from 'vitest';
import * as pl from '@/locales/pl.json';
import * as en from '@/locales/en.json';

/**
 * The guard on two translation files.
 *
 * `TranslationKey` is derived from the Polish file, so a key that exists only in English cannot
 * typecheck — but nothing stops the other direction, and that is the one that happens. A key added
 * to Polish and forgotten in English falls back silently and the app shows Polish words to somebody
 * reading English. Nobody notices, because nobody is looking at the English build.
 *
 * The placeholder check earns its place separately: a translation that drops `{{day}}` renders
 * "on day" with the number missing, which no key comparison would catch.
 */

type Node = Record<string, unknown>;

const flatten = (node: Node, prefix = ''): Record<string, string> =>
  Object.entries(node).reduce<Record<string, string>>((flat, [key, value]) => {
    if (key === 'default') return flat;

    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') return { ...flat, [path]: value };
    if (value && typeof value === 'object') return { ...flat, ...flatten(value as Node, path) };

    return flat;
  }, {});

/** Polish counts in four categories and English in two, so the suffix is not a difference. */
const withoutPluralSuffix = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');

const polish = flatten(pl as Node);
const english = flatten(en as Node);

const baseKeys = (flat: Record<string, string>) =>
  new Set(Object.keys(flat).map(withoutPluralSuffix));

const placeholders = (text: string) => (text.match(/{{\s*\w+\s*}}/g) ?? []).sort();

describe('translation files', () => {
  it('covers every Polish key in English', () => {
    const missing = [...baseKeys(polish)].filter((key) => !baseKeys(english).has(key));

    expect(missing, `keys present in pl.json and missing from en.json: ${missing.join(', ')}`).toEqual(
      []
    );
  });

  it('carries no English key that Polish does not have', () => {
    // The other direction matters too: a stray English key is copy nobody will ever translate back,
    // and it would not typecheck at a call site anyway.
    const extra = [...baseKeys(english)].filter((key) => !baseKeys(polish).has(key));

    expect(extra, `keys present in en.json and missing from pl.json: ${extra.join(', ')}`).toEqual(
      []
    );
  });

  it('uses the same interpolation placeholders on both sides', () => {
    const mismatched = Object.keys(polish)
      .filter((key) => key in english)
      .filter(
        (key) => placeholders(polish[key]).join() !== placeholders(english[key]).join()
      );

    expect(
      mismatched,
      `placeholders differ between locales for: ${mismatched.join(', ')}`
    ).toEqual([]);
  });

  it('leaves nothing blank', () => {
    const blank = Object.entries(english)
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);

    expect(blank, `empty English strings: ${blank.join(', ')}`).toEqual([]);
  });
});
