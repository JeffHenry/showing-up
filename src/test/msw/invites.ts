import { http, HttpResponse } from 'msw';
import type { AcceptedInvite, InviteStatus, PendingInvite } from '@/features/invites/types';
import type { MembershipRole } from '@/context/orgContext';
import { testOrg } from '@/test/fixtures/orgs';
import { REST_URL, restError } from '@/test/msw/rest';

interface PreviewOptions {
  status: InviteStatus;
  orgId?: string;
  orgName?: string;
  role?: MembershipRole;
}

/**
 * Pending and accepted invites share `GET /invites`; they differ in the `used_at` filter
 * (`is.null` vs `not.is.null`). Handlers answer only their own list and otherwise fall through.
 */
function isPendingRequest(request: Request) {
  return new URL(request.url).searchParams.get('used_at') === 'is.null';
}

export const inviteHandlers = {
  /** An organization's pending invites. */
  pending: (invites: PendingInvite[]) =>
    http.get(`${REST_URL}/invites`, ({ request }) =>
      isPendingRequest(request) ? HttpResponse.json(invites) : undefined,
    ),
  pendingFails: () =>
    http.get(`${REST_URL}/invites`, ({ request }) =>
      isPendingRequest(request) ? restError(500, 'XX000', 'internal error') : undefined,
    ),
  /** Recently accepted invites, shaped like the embedded-profiles select returns them. */
  accepted: (invites: AcceptedInvite[]) =>
    http.get(`${REST_URL}/invites`, ({ request }) =>
      isPendingRequest(request)
        ? undefined
        : HttpResponse.json(
            invites.map((invite) => ({
              id: invite.id,
              role: invite.role,
              used_at: invite.usedAt,
              used_by: invite.usedByName === null ? null : { full_name: invite.usedByName },
              created_by:
                invite.createdByName === null ? null : { full_name: invite.createdByName },
            })),
          ),
    ),
  acceptedFails: () =>
    http.get(`${REST_URL}/invites`, ({ request }) =>
      isPendingRequest(request) ? undefined : restError(500, 'XX000', 'internal error'),
    ),
  /** `create_invite` succeeding; `onBody` receives the request's named arguments. */
  createOk: (token: string, expiresAt: string, onBody?: (body: unknown) => void) =>
    http.post(`${REST_URL}/rpc/create_invite`, async ({ request }) => {
      onBody?.(await request.json());
      return HttpResponse.json([
        { invite_id: '00000000-0000-0000-0000-0000000000c9', token, expires_at: expiresAt },
      ]);
    }),
  createFails: (message: string, code = 'P0001') =>
    http.post(`${REST_URL}/rpc/create_invite`, () => restError(400, code, message)),
  /** Revoking (`DELETE /invites?id=eq.<id>`); `onId` receives the revoked invite's id. */
  revokeOk: (onId?: (id: string | null) => void) =>
    http.delete(`${REST_URL}/invites`, ({ request }) => {
      onId?.(new URL(request.url).searchParams.get('id'));
      return new HttpResponse(null, { status: 204 });
    }),
  /** `get_invite`: what the link leads to. Defaults to the test organization, as a volunteer. */
  preview: ({
    status,
    orgId = testOrg.id,
    orgName = testOrg.name,
    role = 'volunteer',
  }: PreviewOptions) =>
    http.post(`${REST_URL}/rpc/get_invite`, () =>
      HttpResponse.json([{ org_id: orgId, org_name: orgName, role, status }]),
    ),
  previewFails: (message: string, code = 'P0001') =>
    http.post(`${REST_URL}/rpc/get_invite`, () => restError(400, code, message)),
  /** `redeem_invite` succeeding; `onBody` receives the request's named arguments. */
  redeemOk: (orgId: string, onBody?: (body: unknown) => void) =>
    http.post(`${REST_URL}/rpc/redeem_invite`, async ({ request }) => {
      onBody?.(await request.json());
      return HttpResponse.json(orgId);
    }),
  redeemFails: (message: string, code = 'P0001') =>
    http.post(`${REST_URL}/rpc/redeem_invite`, () => restError(400, code, message)),
};
