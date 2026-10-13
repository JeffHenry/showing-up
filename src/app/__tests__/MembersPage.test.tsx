import { screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { MembershipRole } from '@/context/orgContext';
import { MembersPage } from '@/app/routes/MembersPage';
import { routes } from '@/app/router';
import type { MyOrganization } from '@/features/orgs/types';
import type { PendingInvite } from '@/features/invites/types';
import { createGate } from '@/test/gate';
import {
  testAcceptedInvite,
  testCoordinatorInvite,
  testInvite,
  testInviteToken,
} from '@/test/fixtures/invites';
import { testMembers } from '@/test/fixtures/members';
import { testOrg } from '@/test/fixtures/orgs';
import { inviteHandlers } from '@/test/msw/invites';
import { memberHandlers } from '@/test/msw/members';
import { REST_URL } from '@/test/msw/rest';
import { server } from '@/test/msw/server';
import { renderRoutes, renderWithProviders } from '@/test/render';

const inviteLink = `${window.location.origin}/invite/${testInviteToken}`;

function renderMembers(role: MembershipRole = 'owner') {
  return renderWithProviders(<MembersPage />, { auth: 'signedIn', org: role });
}

/** Pending invites are requested with `used_at=is.null`; accepted ones use another filter. */
function isPendingRequest(request: Request) {
  return new URL(request.url).searchParams.get('used_at') === 'is.null';
}

/** A pending-invites endpoint backed by a list the test can change (e.g. after a revoke). */

function pendingInvitesStore(initial: PendingInvite[]) {
  let invites = initial;
  server.use(
    http.get(`${REST_URL}/invites`, ({ request }) =>
      isPendingRequest(request) ? HttpResponse.json(invites) : undefined,
    ),
  );
  return {
    set: (next: PendingInvite[]) => {
      invites = next;
    },
  };
}

describe('MembersPage: creating invites', () => {
  it('lets an owner invite a coordinator, then shows the link to copy', async () => {
    server.use(inviteHandlers.pending([]));
    let body: unknown;
    server.use(
      inviteHandlers.createOk(testInviteToken, testInvite.expires_at, (requestBody) => {
        body = requestBody;
      }),
    );
    const { user } = renderMembers('owner');

    await user.selectOptions(screen.getByLabelText('Role'), 'coordinator');
    await user.click(screen.getByRole('button', { name: 'Create invite link' }));

    const link = await screen.findByLabelText('Invite link for a coordinator');
    expect(link).toHaveValue(inviteLink);
    expect(link).toHaveFocus();
    expect(link).toHaveAccessibleDescription(
      "Works once, for one person, until Oct 19, 2026. Copy it now: for security, it can't be shown again.",
    );
    expect(body).toEqual({ p_org_id: testOrg.id, p_role: 'coordinator' });

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(await navigator.clipboard.readText()).toBe(inviteLink);
    expect(await screen.findByText('Link copied.')).toBeInTheDocument();
  });

  it('only lets a coordinator invite volunteers', async () => {
    server.use(inviteHandlers.pending([]));
    let body: unknown;
    server.use(
      inviteHandlers.createOk(testInviteToken, testInvite.expires_at, (requestBody) => {
        body = requestBody;
      }),
    );
    const { user } = renderMembers('coordinator');

    expect(screen.queryByLabelText('Role')).not.toBeInTheDocument();
    expect(screen.getByText(/Ask an owner to invite another coordinator/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create invite link' }));

    expect(await screen.findByLabelText('Invite link for a volunteer')).toBeInTheDocument();
    expect(body).toEqual({ p_org_id: testOrg.id, p_role: 'volunteer' });
  });

  it('explains when the link could not be copied', async () => {
    server.use(
      inviteHandlers.pending([]),
      inviteHandlers.createOk(testInviteToken, testInvite.expires_at),
    );
    const { user } = renderMembers();
    await user.click(screen.getByRole('button', { name: 'Create invite link' }));
    await screen.findByLabelText('Invite link for a volunteer');
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(await screen.findByText(/Couldn't copy automatically/)).toBeInTheDocument();
  });

  it('can create another invite, returning focus to the form', async () => {
    server.use(
      inviteHandlers.pending([]),
      inviteHandlers.createOk(testInviteToken, testInvite.expires_at),
    );
    const { user } = renderMembers();
    await user.click(screen.getByRole('button', { name: 'Create invite link' }));

    await user.click(await screen.findByRole('button', { name: 'Create another invite' }));

    expect(screen.getByRole('button', { name: 'Create invite link' })).toHaveFocus();
    expect(screen.queryByLabelText(/Invite link for/)).not.toBeInTheDocument();
  });

  it('disables the button while the link is created', async () => {
    const gate = createGate();
    server.use(
      inviteHandlers.pending([]),
      http.post(`${REST_URL}/rpc/create_invite`, async () => {
        await gate.opened;
        return HttpResponse.json([
          { invite_id: testInvite.id, token: testInviteToken, expires_at: testInvite.expires_at },
        ]);
      }),
    );
    const { user } = renderMembers();

    await user.click(screen.getByRole('button', { name: 'Create invite link' }));

    expect(await screen.findByRole('button', { name: 'Creating link…' })).toBeDisabled();
    gate.open();
    expect(await screen.findByLabelText('Invite link for a volunteer')).toBeInTheDocument();
  });

  it('explains the pending invite limit', async () => {
    server.use(inviteHandlers.pending([]), inviteHandlers.createFails('INVITE_LIMIT_REACHED'));
    const { user } = renderMembers();

    await user.click(screen.getByRole('button', { name: 'Create invite link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This organization already has 25 pending invites.',
    );
  });

  it('adds a new invite to the pending list', async () => {
    const store = pendingInvitesStore([]);
    server.use(inviteHandlers.createOk(testInviteToken, testInvite.expires_at));
    const { user } = renderMembers();
    expect(await screen.findByText(/No pending invites/)).toBeInTheDocument();

    store.set([testInvite]);
    await user.click(screen.getByRole('button', { name: 'Create invite link' }));

    expect(
      await screen.findByRole('button', { name: 'Revoke volunteer invite expiring Oct 19, 2026' }),
    ).toBeInTheDocument();
  });
});

describe('MembersPage: pending invites', () => {
  it('lists pending invites with their expiry in the organization’s time zone', async () => {
    server.use(inviteHandlers.pending([testInvite, testCoordinatorInvite]));
    renderMembers();

    const list = await screen.findByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('VolunteerExpires Oct 19, 2026');
    expect(items[1]).toHaveTextContent('CoordinatorExpires Oct 21, 2026');
  });

  it('revokes an invite', async () => {
    const store = pendingInvitesStore([testInvite, testCoordinatorInvite]);
    let revokedId: string | null = null;
    server.use(
      inviteHandlers.revokeOk((id) => {
        revokedId = id;
        store.set([testCoordinatorInvite]);
      }),
    );
    const { user } = renderMembers();

    await user.click(
      await screen.findByRole('button', { name: 'Revoke volunteer invite expiring Oct 19, 2026' }),
    );

    expect(await screen.findByText('Invite revoked.')).toBeInTheDocument();
    expect(revokedId).toBe(`eq.${testInvite.id}`);
    expect(
      screen.queryByRole('button', { name: /Revoke volunteer invite/ }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows a loading state, then an empty state', async () => {
    const gate = createGate();
    server.use(
      http.get(`${REST_URL}/invites`, async ({ request }) => {
        if (!isPendingRequest(request)) return undefined;
        await gate.opened;
        return HttpResponse.json([]);
      }),
    );
    renderMembers();

    expect(await screen.findByText('Loading pending invites…')).toBeInTheDocument();
    gate.open();
    expect(await screen.findByText(/No pending invites/)).toBeInTheDocument();
  });

  it('explains a failed load and retries', async () => {
    server.use(inviteHandlers.pendingFails());
    const { user } = renderMembers();

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load pending invites");

    server.use(inviteHandlers.pending([testInvite]));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('list')).toBeInTheDocument();
  });
});

describe('MembersPage: the whole page', () => {
  /** The real route tree, so OrgLayout supplies the role from a (changeable) membership list. */
  function renderMembersRoute(initialRole: MyOrganization['role']) {
    let myOrgs: MyOrganization[] = [{ ...testOrg, role: initialRole }];
    server.use(
      http.get(`${REST_URL}/organizations`, () =>
        HttpResponse.json(myOrgs.map(({ role, ...org }) => ({ ...org, memberships: [{ role }] }))),
      ),
      memberHandlers.list(testMembers),
      inviteHandlers.pending([]),
    );
    const view = renderRoutes(routes, {
      route: `/orgs/${testOrg.id}/members`,
      auth: 'signedIn',
    });
    return {
      ...view,
      setMyRole: (role: MyOrganization['role']) => {
        myOrgs = [{ ...testOrg, role }];
      },
    };
  }

  it('shows inviting, the roster, pending invites, and recently accepted invites', async () => {
    server.use(inviteHandlers.accepted([testAcceptedInvite]));
    renderMembersRoute('owner');

    expect(await screen.findByRole('heading', { name: 'Members (4)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Invite someone' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pending invites' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recently accepted' })).toBeInTheDocument();
    expect(await screen.findByText(/joined as a volunteer/)).toBeInTheDocument();
  });

  it('drops the owner controls after you step down', async () => {
    const { user, setMyRole } = renderMembersRoute('owner');
    server.use(
      memberHandlers.updateOk(() => {
        setMyRole('coordinator');
      }),
    );

    await user.click(await screen.findByRole('button', { name: 'Manage your role' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Make coordinator' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Step down to coordinator?' });
    await user.click(within(dialog).getByRole('button', { name: 'Step down' }));

    expect(await screen.findByText("You're now a coordinator.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Manage/ })).not.toBeInTheDocument();
    // Coordinators can still see the page, but only invite volunteers.
    expect(screen.getByText(/Ask an owner to invite another coordinator/)).toBeInTheDocument();
  });
});

describe('MembersPage: accessibility', () => {
  it('has no detectable accessibility violations, before and after creating a link', async () => {
    server.use(
      inviteHandlers.pending([testInvite]),
      inviteHandlers.createOk(testInviteToken, testInvite.expires_at),
    );
    const { container, user } = renderMembers();
    await screen.findByRole('list');

    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Create invite link' }));
    await screen.findByLabelText('Invite link for a volunteer');
    expect(await axe(container)).toHaveNoViolations();
  });
});
