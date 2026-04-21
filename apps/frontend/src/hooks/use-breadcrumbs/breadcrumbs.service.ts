import { paths } from '@/routes/paths.ts';
import type { TranslationKey } from '@/i18n.ts';

export function findLabelByPath(
  obj: Record<string, any>,
  targetPath: string,
  parentKey?: string
): string | null {
  for (const key in obj) {
    if (typeof obj[key] === 'string' && obj[key] === targetPath) {
      // If the key is 'root' and parentKey exists, return parentKey as label
      if (key === 'root' && parentKey) {
        return parentKey;
      }
      return key;
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const label = findLabelByPath(obj[key], targetPath, key);
      if (label) return label;
    }
  }
  return null;
}

type Breadcrumbs = {
  path: string;
  label: TranslationKey;
};

export function getBreadcrumbsSegments(pathname: string): Breadcrumbs[] {
  const segments = pathname.split('/').filter(Boolean);

  const breadcrumbs: Breadcrumbs[] = [];
  let currentPath = '';

  for (const segment of segments) {
    currentPath += '/' + segment;
    const label = findLabelByPath(paths, currentPath) as TranslationKey;
    if (label) {
      breadcrumbs.push({ label, path: currentPath });
    } else {
      // Stop if any segment is not found
      return [];
    }
  }

  return breadcrumbs;
}
