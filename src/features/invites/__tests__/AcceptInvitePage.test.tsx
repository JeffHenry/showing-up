import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import type { MyOrganization } from '@/features/orgs/types';
import { createGate } from '@/test/gate';
import { testInviteToken } from '@/test/fixtures/invites';
import { testOrg } from '@/test/fixtures/orgs';
import { inviteHandlers } from '@/test/msw/invites';
import { REST_URL } from '@/test/msw/rest';
import { server } from '@/test/msw/server';
import { renderRoutes } from '@/test/render';

const joinedAsVolunteer: MyOrganization = { ...testOrg, role: 'volunteer' };

// The real route tree, so joining lands on the organization through OrgLayout.
function renderInvite() {
  return renderRoutes(routes, { route: `/invite/${testInviteToken}`, auth: 'signedIn' });
}

describe('AcceptInvitePage', () => {
  it('asks before joining, then joins and opens the organization', async () => {
    let orgs: MyOrganization[] = [];
    let body: unknown;
    server.use(
      inviteHandlers.preview({ status: 'valid' }),
      http.get(`${REST_URL}/organizations`, () =>
        HttpResponse.json(orgs.map(({ role, ...org }) => ({ ...org, memberships: [{ role }] }))),
      ),
      inviteHandlers.redeemOk(testOrg.id, (requestBody) => {
        body = requestBody;
        orgs = [joinedAsVolunteer];
      }),
    );
    const { user, router } = renderInvite();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Join Riverside Food Bank?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/invited to join as a/)).toHaveTextContent(
      "You've been invited to join as a volunteer.",
    );

    await user.click(screen.getByRole('button', { name: 'Join Riverside Food Bank' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Riverside Food Bank' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Your role: Volunteer')).toBeInTheDocument();
    expect(body).toEqual({ p_token: testInviteToken });
    // Replaced, so Back doesn't return to the single-use link.
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('disables Join while joining', async () => {
    const gate = createGate();
    server.use(
      inviteHandlers.preview({ status: 'valid' }),
      http.post(`${REST_URL}/rpc/redeem_invite`, async () => {
        await gate.opened;
        return HttpResponse.json(testOrg.id);
      }),
    );
    const { user } = renderInvite();

    await user.click(await screen.findByRole('button', { name: 'Join Riverside Food Bank' }));

    expect(await screen.findByRole('button', { name: 'Joining…' })).toBeDisabled();
    gate.open();
  });

  it('explains a link that was used by someone else in the meantime', async () => {
    server.use(
      inviteHandlers.preview({ status: 'valid' }),
      inviteHandlers.redeemFails('INVITE_USED'),
    );
    const { user } = renderInvite();

    await user.click(await screen.findByRole('button', { name: 'Join Riverside Food Bank' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This invite link has already been used.',
    );
  });

  it('offers to open the organization when already a member', async () => {
    server.use(inviteHandlers.preview({ status: 'member' }));
    renderInvite();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: "You're already a member of Riverside Food Bank",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Riverside Food Bank' })).toHaveAttribute(
      'href',
      `/orgs/${testOrg.id}`,
    );
  });

  it.each([
    ['used', 'This invite was already used', 'This invite link has already been used.'],
    ['expired', 'This invite has expired', 'This invite link has expired.'],
  ] as const)('explains a %s invite', async (status, heading, message) => {
    server.use(inviteHandlers.preview({ status }));
    renderInvite();

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Your organizations' })).toHaveAttribute(
      'href',
      '/orgs',
    );
    expect(screen.queryByRole('button', { name: /Join/ })).not.toBeInTheDocument();
  });

  it('explains a link that does not exist or was revoked', async () => {
    server.use(inviteHandlers.previewFails('INVITE_NOT_FOUND'));
    renderInvite();

    expect(
      await screen.findByRole('heading', { level: 1, name: "This invite link isn't valid" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/It may have been revoked/)).toBeInTheDocument();
  });

  it('offers a retry when the invitation cannot be checked', async () => {
    server.use(http.post(`${REST_URL}/rpc/get_invite`, () => HttpResponse.error()));
    const { user } = renderInvite();

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't check your invitation");

    server.use(inviteHandlers.preview({ status: 'valid' }));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Join Riverside Food Bank?' }),
    ).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    server.use(inviteHandlers.preview({ status: 'valid' }));
    const { container } = renderInvite();

    await screen.findByRole('heading', { level: 1, name: 'Join Riverside Food Bank?' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
