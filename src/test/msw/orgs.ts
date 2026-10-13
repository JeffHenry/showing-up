import { http, HttpResponse } from 'msw';
import type { MyOrganization } from '@/features/orgs/types';
import { organizationOf } from '@/test/fixtures/orgs';
import { REST_URL, restError } from '@/test/msw/rest';

export const orgHandlers = {
  /** The user's organizations, shaped like `select(..., memberships!inner(role))` returns them. */
  list: (orgs: MyOrganization[]) =>
    http.get(`${REST_URL}/organizations`, () =>
      HttpResponse.json(
        orgs.map((org) => ({ ...organizationOf(org), memberships: [{ role: org.role }] })),
      ),
    ),
  listFails: () =>
    http.get(`${REST_URL}/organizations`, () => restError(500, 'XX000', 'internal error')),
  /** `create_organization` succeeding; `onBody` receives the request's named arguments. */
  createOk: (org: MyOrganization, onBody?: (body: unknown) => void) =>
    http.post(`${REST_URL}/rpc/create_organization`, async ({ request }) => {
      onBody?.(await request.json());
      return HttpResponse.json(organizationOf(org));
    }),
  /** `create_organization` raising a typed error, e.g. `SLUG_TAKEN` or `ORG_LIMIT_REACHED`. */
  createFails: (message: string, code = 'P0001') =>
    http.post(`${REST_URL}/rpc/create_organization`, () => restError(400, code, message)),
};
