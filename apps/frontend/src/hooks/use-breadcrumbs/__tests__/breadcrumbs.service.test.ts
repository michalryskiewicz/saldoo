import { findLabelByPath, getBreadcrumbsSegments } from '../breadcrumbs.service';
import { describe, it, expect } from 'vitest';
import { paths } from '@/routes/paths.ts';
import pl from '@/locales/pl.json';

describe('breadcrumbs.service.ts', () => {
  describe('findLabelByPath', () => {
    it('returns the key when the path matches a string value', () => {
      const obj = { home: '/home', about: '/about' };
      expect(findLabelByPath(obj, '/about')).toBe('about');
    });

    it('returns the key when the path matches a nested object value', () => {
      const obj = { main: { dashboard: '/dashboard' } };
      expect(findLabelByPath(obj, '/dashboard')).toBe('dashboard');
    });

    it('returns null when the path does not exist', () => {
      const obj = { home: '/home' };
      expect(findLabelByPath(obj, '/missing')).toBeNull();
    });

    it('returns the first matching key in case of duplicate paths', () => {
      const obj = { first: '/same', second: '/same' };
      expect(findLabelByPath(obj, '/same')).toBe('first');
    });

    it('returns null for empty object', () => {
      expect(findLabelByPath({}, '/any')).toBeNull();
    });
  });

  describe('getBreadcrumbsSegments', () => {
    it('returns correct breadcrumb segments for a valid path', () => {
      const result = getBreadcrumbsSegments('/dashboard/profits');
      expect(result).toEqual([
        { label: 'dashboard', path: '/dashboard' },
        { label: 'profits', path: '/dashboard/profits' },
      ]);
    });

    it('returns an empty array for a path with no matching segments', () => {
      expect(getBreadcrumbsSegments('/unknown/path')).toEqual([]);
    });

    it('handles root path and returns empty array', () => {
      expect(getBreadcrumbsSegments('/')).toEqual([]);
    });

    it('ignores empty segments in the path', () => {
      expect(getBreadcrumbsSegments('///')).toEqual([]);
    });

    it('returns only segments that exist in paths', () => {
      expect(getBreadcrumbsSegments('/home/extra')).toEqual([]);
    });

    it('returns correct segments for account', () => {
      expect(getBreadcrumbsSegments('/dashboard/account')).toEqual([
        { label: 'dashboard', path: '/dashboard' },
        { label: 'account', path: '/dashboard/account' },
      ]);
    });
  });
});

/**
 * Every dashboard route's key has to be a string in the translations, because the breadcrumb takes
 * the key straight off `paths` and translates it.
 *
 * Written after a goals screen shipped a nested `goals` block into the very key the breadcrumb
 * wanted, and the header read "key 'goals (pl)' returned an object instead of string" — visible in
 * the app, invisible to every test, and a class of mistake the next route can make just as easily.
 */
describe('every route a breadcrumb can reach has a name', () => {
  it('translates each dashboard path to a string', () => {
    for (const [key, path] of Object.entries(paths.dashboard)) {
      if (typeof path !== 'string') continue;

      const label = findLabelByPath(paths, path);
      if (!label) continue;

      expect(typeof pl[label as keyof typeof pl], `${key} is not a string in pl.json`).toBe(
        'string'
      );
    }
  });
});
