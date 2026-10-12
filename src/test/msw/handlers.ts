import type { RequestHandler } from 'msw';
import { authHandlers } from '@/test/msw/auth';

/**
 * Default handlers shared by every test. Keep these to happy-path responses and
 * override per test with `server.use(...)`.
 */
export const handlers: RequestHandler[] = [
  // The login page asks which sign-in providers are enabled.
  authHandlers.settings({ google: true }),
];
