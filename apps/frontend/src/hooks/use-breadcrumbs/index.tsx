import { useLocation } from 'react-router';
import { getBreadcrumbsSegments } from '@/hooks/use-breadcrumbs/breadcrumbs.service.ts';

export const useBreadcrumbs = () => {
  const { pathname } = useLocation();

  const breadcrumbs = getBreadcrumbsSegments(pathname);

  return { breadcrumbs };
};
