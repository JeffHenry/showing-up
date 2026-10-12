import type { RouteObject } from 'react-router';
import { AppLayout } from '@/app/layouts/AppLayout';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';
import { RequireAuth } from '@/features/auth/components/RequireAuth';

/**
 * The app's route tree. Exported without a router instance so tests can mount the same tree
 * in a memory router; `main.tsx` creates the browser router.
 *
 * Pages load with React Router's `lazy`, so each page is a separate download and the router
 * fetches it before switching pages (no blank flash between routes).
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppLayout,
    ErrorBoundary: RouteErrorBoundary,
    HydrateFallback: LoadingScreen,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('@/app/routes/LandingPage')).LandingPage }),
      },
      {
        path: 'privacy',
        lazy: async () => ({ Component: (await import('@/app/routes/PrivacyPage')).PrivacyPage }),
      },
      {
        Component: AuthLayout,
        children: [
          {
            path: 'login',
            lazy: async () => ({
              Component: (await import('@/features/auth/components/LoginPage')).LoginPage,
            }),
          },
          {
            path: 'auth/callback',
            lazy: async () => ({
              Component: (await import('@/features/auth/components/AuthCallbackPage'))
                .AuthCallbackPage,
            }),
          },
        ],
      },
      {
        // Everything below requires a signed-in user.
        Component: RequireAuth,
        children: [
          {
            path: 'orgs',
            lazy: async () => ({
              Component: (await import('@/features/orgs/components/OrgsPage')).OrgsPage,
            }),
          },
          {
            // Ranked above `orgs/:orgId` because static segments win.
            path: 'orgs/new',
            lazy: async () => ({
              Component: (await import('@/features/orgs/components/CreateOrgPage')).CreateOrgPage,
            }),
          },
          {
            // Lazy like the pages: it loads the Supabase client, which the initial bundle excludes.
            path: 'orgs/:orgId',
            lazy: async () => ({
              Component: (await import('@/app/layouts/OrgLayout')).OrgLayout,
            }),
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('@/features/orgs/components/OrgDashboardPage'))
                    .OrgDashboardPage,
                }),
              },
            ],
          },
        ],
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/app/routes/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
];
