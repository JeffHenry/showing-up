import { http, HttpResponse } from 'msw';
import type { ShiftDetail, ShiftSummary } from '@/features/shifts/types';
import { REST_URL, restError } from '@/test/msw/rest';

/**
 * Lists and single shifts share `GET /shifts`: a list filters on `org_id`, a shift's page on
 * `id`. Handlers answer only their own kind of request and otherwise fall through.
 */
function isListRequest(request: Request) {
  return new URL(request.url).searchParams.has('org_id');
}

export const shiftHandlers = {
  /**
   * An organization's shifts: `firstPage` for the first request, `nextPage` once the request
   * carries a cursor (`or=`). `onRequest` receives each request's search params.
   */
  list: (
    firstPage: ShiftSummary[],
    nextPage: ShiftSummary[] = [],
    onRequest?: (params: URLSearchParams) => void,
  ) =>
    http.get(`${REST_URL}/shifts`, ({ request }) => {
      if (!isListRequest(request)) return undefined;
      const params = new URL(request.url).searchParams;
      onRequest?.(params);
      return HttpResponse.json(params.has('or') ? nextPage : firstPage);
    }),
  listFails: () =>
    http.get(`${REST_URL}/shifts`, ({ request }) =>
      isListRequest(request) ? restError(500, 'XX000', 'internal error') : undefined,
    ),
  /** A shift's page; `null` when it doesn't exist or the user can't see it. */
  detail: (shift: ShiftDetail | null) =>
    http.get(`${REST_URL}/shifts`, ({ request }) =>
      isListRequest(request) ? undefined : HttpResponse.json(shift ? [shift] : []),
    ),
  detailFails: () =>
    http.get(`${REST_URL}/shifts`, ({ request }) =>
      isListRequest(request) ? undefined : restError(500, 'XX000', 'internal error'),
    ),
  /** Creating a shift; `onBody` receives the inserted row. */
  createOk: (id: string, onBody?: (body: unknown) => void) =>
    http.post(`${REST_URL}/shifts`, async ({ request }) => {
      onBody?.(await request.json());
      return HttpResponse.json({ id });
    }),
  createFails: (message: string, code = 'P0001') =>
    http.post(`${REST_URL}/shifts`, () => restError(400, code, message)),
};
