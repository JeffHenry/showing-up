import { HttpResponse } from 'msw';

/** Supabase's REST API (PostgREST) as the real client calls it in tests (see vite.config.ts env). */
export const REST_URL = 'http://localhost:54321/rest/v1';

/** An error body in PostgREST's format, e.g. a database function's typed error (`P0001`). */
export function restError(status: number, code: string, message: string) {
  return HttpResponse.json({ code, message, details: null, hint: null }, { status });
}
