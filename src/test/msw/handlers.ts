import type { RequestHandler } from 'msw';
import { authHandlers } from '@/test/msw/auth';
import { orgHandlers } from '@/test/msw/orgs';

/**
 * Default handlers shared by every test. Keep these to happy-path responses and
 * override per test with `server.use(...)`.
 */
export const handlers: RequestHandler[] = [
  // The login page asks which sign-in providers are enabled.
  authHandlers.settings({ google: true }),
  // Signed-in pages load the user's organizations; a new user has none.
  orgHandlers.list([]),
];
