import { http, HttpResponse } from 'msw';
import type { ShiftDetail, ShiftSummary } from '@/features/shifts/types';
import { REST_URL, restError } from '@/test/msw/rest';

/**
 * Lists, overlap checks, and single shifts share `GET /shifts`. A list filters on `org_id`; an
 * overlap check also filters on `cancelled_at`; a shift's page filters on `id`. Handlers answer
 * only their own kind of request and otherwise fall through.
 */
type ShiftRequest = 'list' | 'overlaps' | 'detail';

function kindOf(request: Request): ShiftRequest {
  const params = new URL(request.url).searchParams;
  if (params.has('cancelled_at')) return 'overlaps';
  return params.has('org_id') ? 'list' : 'detail';
}

/** What an update targeted, read from its PostgREST filters. */
export interface ShiftUpdateRequest {
  id: string | null;
  version: string | null;
  body: unknown;
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
      if (kindOf(request) !== 'list') return undefined;
      const params = new URL(request.url).searchParams;
      onRequest?.(params);
      return HttpResponse.json(params.has('or') ? nextPage : firstPage);
    }),
  listFails: () =>
    http.get(`${REST_URL}/shifts`, ({ request }) =>
      kindOf(request) === 'list' ? restError(500, 'XX000', 'internal error') : undefined,
    ),
  /** The form's overlap check; `onRequest` receives each request's search params. */
  overlaps: (shifts: ShiftSummary[], onRequest?: (params: URLSearchParams) => void) =>
    http.get(`${REST_URL}/shifts`, ({ request }) => {
      if (kindOf(request) !== 'overlaps') return undefined;
      onRequest?.(new URL(request.url).searchParams);
      return HttpResponse.json(shifts);
    }),
  /** A shift's page; `null` when it doesn't exist or the user can't see it. */
  detail: (shift: ShiftDetail | null) =>
    http.get(`${REST_URL}/shifts`, ({ request }) =>
      kindOf(request) === 'detail' ? HttpResponse.json(shift ? [shift] : []) : undefined,
    ),
  detailFails: () =>
    http.get(`${REST_URL}/shifts`, ({ request }) =>
      kindOf(request) === 'detail' ? restError(500, 'XX000', 'internal error') : undefined,
    ),
  /** Creating a shift; `onBody` receives the inserted row. */
  createOk: (id: string, onBody?: (body: unknown) => void) =>
    http.post(`${REST_URL}/shifts`, async ({ request }) => {
      onBody?.(await request.json());
      return HttpResponse.json({ id });
    }),
  createFails: (message: string, code = 'P0001') =>
    http.post(`${REST_URL}/shifts`, () => restError(400, code, message)),
  /** An edit that saved; `onRequest` receives the filters (id, version) and the body. */
  updateOk: (onRequest?: (request: ShiftUpdateRequest) => void) =>
    http.patch(`${REST_URL}/shifts`, async ({ request }) => {
      const params = new URL(request.url).searchParams;
      const id = params.get('id')?.replace(/^eq\./, '') ?? null;
      onRequest?.({
        id,
        version: params.get('version')?.replace(/^eq\./, '') ?? null,
        body: await request.json(),
      });
      return HttpResponse.json([{ id }]);
    }),
  /** An edit that matched no rows: the version moved on, the shift is gone, or RLS refused. */
  updateNoRows: () => http.patch(`${REST_URL}/shifts`, () => HttpResponse.json([])),
  updateFails: (message: string, code = 'P0001') =>
    http.patch(`${REST_URL}/shifts`, () => restError(400, code, message)),
  /** `cancel_shift`; `onBody` receives its named arguments. */
  cancelOk: (onBody?: (body: unknown) => void) =>
    http.post(`${REST_URL}/rpc/cancel_shift`, async ({ request }) => {
      onBody?.(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  cancelFails: (message: string, code = 'P0001') =>
    http.post(`${REST_URL}/rpc/cancel_shift`, () => restError(400, code, message)),
  /** Deleting a shift; `onId` receives the id it targeted. */
  deleteOk: (onId?: (id: string | null) => void) =>
    http.delete(`${REST_URL}/shifts`, ({ request }) => {
      const id = new URL(request.url).searchParams.get('id')?.replace(/^eq\./, '') ?? null;
      onId?.(id);
      return HttpResponse.json([{ id }]);
    }),
  deleteNoRows: () => http.delete(`${REST_URL}/shifts`, () => HttpResponse.json([])),
  deleteFails: (message: string, code = 'P0001') =>
    http.delete(`${REST_URL}/shifts`, () => restError(400, code, message)),
};
