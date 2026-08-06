import type { RouteObject } from 'react-router';
import { Outlet } from 'react-router';
import { lazy, Suspense } from 'react';
import { usePathname } from '../hooks';
import { AuthGuard } from '@/auth/guard';
import { CONFIG } from '@/global-config.ts';
import MiniDrawer from '../../layouts/dashboard-layout.tsx';
import { paths } from '@/routes/paths.ts';
import { ContentSkeleton } from '@/components/loaders/content-skeleton.tsx';
import { MetaDataWrapper } from '@/routes/components';
import { DataSyncWrapper } from '@/database/sync/data-sync-wrapper.tsx';
import { OnboardingWrapper } from '@/features/onboarding/onboarding-wrapper.tsx';
import { VaultGate } from '@/features/vault/vault-gate.tsx';

const IndexPage = lazy(() => import('@/pages/dashboard/main.tsx'));
const DutiesPage = lazy(() => import('@/pages/dashboard/duties.tsx'));
const GoalsPage = lazy(() => import('@/pages/dashboard/goals.tsx'));
const ExpensesPage = lazy(() => import('@/pages/dashboard/expenses.tsx'));
const ProfitsPage = lazy(() => import('@/pages/dashboard/profits.tsx'));
const TransactionsPage = lazy(() => import('@/pages/dashboard/transactions.tsx'));
const AccountPage = lazy(() => import('@/pages/dashboard/account/account.tsx'));

// eslint-disable-next-line react-refresh/only-export-components
function SuspenseOutlet() {
  const pathname = usePathname();
  return (
    <Suspense key={pathname} fallback={<ContentSkeleton />}>
      <Outlet />
    </Suspense>
  );
}

const dashboardLayout = () => (
  <VaultGate>
    <DataSyncWrapper>
      <OnboardingWrapper>
        <MiniDrawer>
          <SuspenseOutlet />
        </MiniDrawer>
      </OnboardingWrapper>
    </DataSyncWrapper>
  </VaultGate>
);

export const dashboardRoutes: RouteObject[] = [
  {
    path: paths.dashboard.root,
    element: CONFIG.auth.skip ? dashboardLayout() : <AuthGuard>{dashboardLayout()}</AuthGuard>,
    children: [
      {
        element: (
          <MetaDataWrapper page="root">
            <IndexPage />
          </MetaDataWrapper>
        ),
        index: true,
      },
      {
        path: paths.dashboard.duties,
        element: (
          <MetaDataWrapper page="duties">
            <DutiesPage />
          </MetaDataWrapper>
        ),
      },
      {
        path: paths.dashboard.goals,
        element: (
          <MetaDataWrapper page="goals">
            <GoalsPage />
          </MetaDataWrapper>
        ),
      },
      {
        path: paths.dashboard.expenses,
        children: [
          {
            element: (
              <MetaDataWrapper page="expenses">
                <ExpensesPage />
              </MetaDataWrapper>
            ),
            index: true,
          },
        ],
      },
      {
        path: paths.dashboard.profits,
        children: [
          {
            element: (
              <MetaDataWrapper page="profits">
                <ProfitsPage />
              </MetaDataWrapper>
            ),
            index: true,
          },
        ],
      },
      {
        path: paths.dashboard.transactions,
        children: [
          {
            element: (
              <MetaDataWrapper page="transactions">
                <TransactionsPage />
              </MetaDataWrapper>
            ),
            index: true,
          },
        ],
      },
      {
        path: paths.account.root,
        index: true,
        element: (
          <MetaDataWrapper page="account">
            <AccountPage />
          </MetaDataWrapper>
        ),
      },
    ],
  },
];
