import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  fetchInvitePreview,
  fetchPendingInvites,
  inviteUrl,
} from '@/features/invites/api/invitesApi';
import { testInvite, testInviteToken } from '@/test/fixtures/invites';
import { testOrg } from '@/test/fixtures/orgs';
import { REST_URL } from '@/test/msw/rest';
import { server } from '@/test/msw/server';

describe('inviteUrl', () => {
  it('builds the link an invitee opens on this site', () => {
    expect(inviteUrl(testInviteToken)).toBe(`${window.location.origin}/invite/${testInviteToken}`);
  });
});

describe('fetchPendingInvites', () => {
  it('asks only for unused, unexpired invites, soonest to expire first', async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`${REST_URL}/invites`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json([testInvite]);
      }),
    );

    expect(await fetchPendingInvites(testOrg.id)).toEqual([testInvite]);

    const params = requests[0]?.searchParams;
    expect(params?.get('org_id')).toBe(`eq.${testOrg.id}`);
    expect(params?.get('used_at')).toBe('is.null');
    expect(params?.get('expires_at')).toMatch(/^gt\./);
    expect(params?.get('order')).toBe('expires_at.asc');
    expect(params?.get('select')).not.toContain('token');
  });

  it('skips rows with a role an invite can never have', async () => {
    server.use(
      http.get(`${REST_URL}/invites`, () =>
        HttpResponse.json([testInvite, { ...testInvite, id: 'odd', role: 'owner' }]),
      ),
    );

    expect(await fetchPendingInvites(testOrg.id)).toEqual([testInvite]);
  });
});

describe('fetchInvitePreview', () => {
  it('rejects a status the app does not know', async () => {
    server.use(
      http.post(`${REST_URL}/rpc/get_invite`, () =>
        HttpResponse.json([
          { org_id: testOrg.id, org_name: testOrg.name, role: 'volunteer', status: 'weird' },
        ]),
      ),
    );

    await expect(fetchInvitePreview(testInviteToken)).rejects.toThrow(
      'get_invite returned an unexpected result.',
    );
  });
});
