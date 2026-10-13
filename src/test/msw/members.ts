import { http, HttpResponse } from 'msw';
import type { OrgMember } from '@/features/members/types';
import { REST_URL, restError } from '@/test/msw/rest';

/** What a membership change targeted, read from the request's PostgREST filters. */
export interface MembershipRequest {
  orgId: string | null;
  userId: string | null;
  body?: unknown;
}

function target(request: Request): Omit<MembershipRequest, 'body'> {
  const params = new URL(request.url).searchParams;
  return {
    orgId: params.get('org_id')?.replace(/^eq\./, '') ?? null,
    userId: params.get('user_id')?.replace(/^eq\./, '') ?? null,
  };
}

export const memberHandlers = {
  /** `list_org_members`, in the database function's row shape. */
  list: (members: OrgMember[]) =>
    http.post(`${REST_URL}/rpc/list_org_members`, () =>
      HttpResponse.json(
        members.map((member) => ({
          user_id: member.userId,
          full_name: member.fullName,
          email: member.email,
          role: member.role,
          joined_at: member.joinedAt,
        })),
      ),
    ),
  listFails: () =>
    http.post(`${REST_URL}/rpc/list_org_members`, () => restError(500, 'XX000', 'internal error')),
  /** A role change (`PATCH /memberships`) that updates one row. */
  updateOk: (onRequest?: (request: MembershipRequest) => void) =>
    http.patch(`${REST_URL}/memberships`, async ({ request }) => {
      const where = target(request);
      onRequest?.({ ...where, body: await request.json() });
      return HttpResponse.json([{ user_id: where.userId }]);
    }),
  /** A role change refused by RLS: PostgREST reports success with no rows. */
  updateNoRows: () => http.patch(`${REST_URL}/memberships`, () => HttpResponse.json([])),
  updateFails: (message: string, code = 'P0001') =>
    http.patch(`${REST_URL}/memberships`, () => restError(400, code, message)),
  /** Removing a member or leaving (`DELETE /memberships`). */
  removeOk: (onRequest?: (request: MembershipRequest) => void) =>
    http.delete(`${REST_URL}/memberships`, ({ request }) => {
      const where = target(request);
      onRequest?.(where);
      return HttpResponse.json([{ user_id: where.userId }]);
    }),
  removeFails: (message: string, code = 'P0001') =>
    http.delete(`${REST_URL}/memberships`, () => restError(400, code, message)),
};
