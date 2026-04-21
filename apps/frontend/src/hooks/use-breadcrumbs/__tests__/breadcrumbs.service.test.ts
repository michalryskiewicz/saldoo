import { findLabelByPath, getBreadcrumbsSegments } from '../breadcrumbs.service';
import { describe, it, expect } from 'vitest';

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
