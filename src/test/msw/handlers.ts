import type { RequestHandler } from 'msw';

/**
 * Default handlers shared by every test. Keep these to happy-path responses and
 * override per test with `server.use(...)`.
 */
export const handlers: RequestHandler[] = [];
