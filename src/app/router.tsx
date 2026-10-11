import type { RouteObject } from 'react-router';
import { AppLayout } from '@/app/layouts/AppLayout';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';

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
        path: '*',
        lazy: async () => ({ Component: (await import('@/app/routes/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
];
