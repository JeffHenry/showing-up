import { http, HttpResponse } from 'msw';
import { REST_URL, restError } from '@/test/msw/rest';

/** Holds a response until the test is ready (see `createGate`). */
type Wait = () => Promise<void>;

export const signupHandlers = {
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
