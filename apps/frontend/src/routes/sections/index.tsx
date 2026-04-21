import type { RouteObject } from 'react-router';
import { lazy } from 'react';
import { Navigate } from 'react-router';
import { authRoutes } from './auth.tsx';
import { dashboardRoutes } from './dashboard.tsx';
import { paths } from '@/routes/paths.ts';

const Page404 = lazy(() => import('@/pages/error/404.tsx'));

export const routesSection: RouteObject[] = [
  ...authRoutes,
  ...dashboardRoutes,
  { path: '/', element: <Navigate to={paths.auth.google.signIn} replace /> },
  { path: '*', element: <Page404 /> },
];
