import type { RouteObject } from 'react-router';

import { Outlet } from 'react-router';
import { lazy, Suspense } from 'react';

import { GuestGuard } from '@/auth/guard';
import { AppLoading } from '@/components/loaders/app-loading.tsx';
import { MetaDataWrapper } from '@/routes/components';
import { paths } from '@/routes/paths.ts';

const Google = {
  SignInPage: lazy(() => import('@/pages/auth/sign-in.tsx')),
};

const authGoogle = {
  path: 'google',
  children: [
    {
      path: 'sign-in',
      element: (
        <GuestGuard>
          <MetaDataWrapper page="sign-in">
            <Google.SignInPage />
          </MetaDataWrapper>
        </GuestGuard>
      ),
    },
  ],
};

export const authRoutes: RouteObject[] = [
  {
    path: paths.auth.root,
    element: (
      <Suspense fallback={<AppLoading />}>
        <Outlet />
      </Suspense>
    ),
    children: [authGoogle],
  },
];
