import { http, HttpResponse } from 'msw';
import type { ShiftSignup } from '@/features/signups/types';
import { REST_URL, restError } from '@/test/msw/rest';

/** Holds a response until the test is ready (see `createGate`). */
type Wait = () => Promise<void>;

export const signupHandlers = {
  /** Who's coming to a shift, shaped as the embedded-profile select returns it. */
  list: (signups: ShiftSignup[], onRequest?: (params: URLSearchParams) => void) =>
    http.get(`${REST_URL}/signups`, ({ request }) => {
      onRequest?.(new URL(request.url).searchParams);
      return HttpResponse.json(
        signups.map((signup) => ({
          user_id: signup.userId,
          updated_at: signup.signedUpAt,
          profile: { full_name: signup.fullName },
        })),
      );
    }),
  listFails: () => http.get(`${REST_URL}/signups`, () => restError(500, 'XX000', 'internal error')),
  /** `claim_shift` succeeding; `onBody` receives its named arguments. */
  claimOk: (onBody?: (body: unknown) => void, wait?: Wait) =>
    http.post(`${REST_URL}/rpc/claim_shift`, async ({ request }) => {
      onBody?.(await request.json());
      await wait?.();
      return new HttpResponse(null, { status: 204 });
    }),
  claimFails: (message: string, code = 'P0001', wait?: Wait) =>
    http.post(`${REST_URL}/rpc/claim_shift`, async () => {
      await wait?.();
      return restError(400, code, message);
    }),
  /** `cancel_signup` succeeding; `onBody` receives its named arguments. */
  cancelOk: (onBody?: (body: unknown) => void, wait?: Wait) =>
    http.post(`${REST_URL}/rpc/cancel_signup`, async ({ request }) => {
      onBody?.(await request.json());
      await wait?.();
      return new HttpResponse(null, { status: 204 });
    }),
  cancelFails: (message: string, code = 'P0001', wait?: Wait) =>
    http.post(`${REST_URL}/rpc/cancel_signup`, async () => {
      await wait?.();
      return restError(400, code, message);
    }),
};
