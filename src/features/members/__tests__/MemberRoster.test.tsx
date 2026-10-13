import { screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { MemberRoster } from '@/features/members/components/MemberRoster';
import type { OrgMember } from '@/features/members/types';
import { testUser } from '@/test/fixtures/auth';
import {
  coordinatorMember,
  meAsOwner,
  testMembers,
  unnamedMember,
  volunteerMember,
} from '@/test/fixtures/members';
import { testOrg } from '@/test/fixtures/orgs';
import { memberHandlers, type MembershipRequest } from '@/test/msw/members';
import { REST_URL } from '@/test/msw/rest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

function renderRoster({ canManage = true, route = '/members' } = {}) {
  return renderWithProviders(
    <MemberRoster
      orgId={testOrg.id}
      orgName={testOrg.name}
      timeZone={testOrg.timezone}
      canManage={canManage}
    />,
    { route, auth: 'signedIn' },
  );
}

/** A roster endpoint backed by a list the test can change (e.g. after a removal). */
function rosterStore(initial: OrgMember[]) {
  let members = initial;
  server.use(
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
  );
  return {
    set: (next: OrgMember[]) => {
      members = next;
    },
  };
}

function rows() {
  return within(screen.getByRole('list')).getAllByRole('listitem');
}

type User = ReturnType<typeof renderRoster>['user'];

async function openMenu(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('menu');
}

describe('MemberRoster: listing', () => {
  it('lists members with role, email, and join date in the organization’s time zone', async () => {
    server.use(memberHandlers.list(testMembers));
    renderRoster();

    expect(await screen.findByRole('heading', { name: 'Members (4)' })).toBeInTheDocument();
    const [me, , jordan, unnamed] = rows();
    expect(me).toHaveTextContent(`Taylor Tester (you)${String(testUser.email)}Owner`);
    expect(jordan).toHaveTextContent('Jordan Leejordan@example.testVolunteerJoined Oct 12, 2026');
    expect(unnamed).toHaveTextContent('Unnamed member');
  });

  it('shows a loading state, then explains a failed load and retries', async () => {
    server.use(memberHandlers.listFails());
    const { user } = renderRoster();

    expect(screen.getByText('Loading members…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the member list");

    server.use(memberHandlers.list(testMembers));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Members (4)' })).toBeInTheDocument();
  });

  it('hides management from coordinators', async () => {
    server.use(memberHandlers.list(testMembers));
    renderRoster({ canManage: false });

    await screen.findByRole('heading', { name: 'Members (4)' });
    expect(screen.queryByRole('button', { name: /Manage/ })).not.toBeInTheDocument();
  });
});

describe('MemberRoster: search and filter', () => {
  it('searches names and emails, keeping the search in the URL', async () => {
    server.use(memberHandlers.list(testMembers));
    const { user, router } = renderRoster();

    await user.type(await screen.findByLabelText('Search by name or email'), 'quiet');

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent(unnamedMember.email);
    expect(screen.getByText('Showing 1 of 4 members.')).toBeInTheDocument();
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('quiet');
  });

  it('filters by role from the URL and the role select', async () => {
    server.use(memberHandlers.list(testMembers));
    const { user, router } = renderRoster({ route: '/members?role=coordinator' });

    expect(await screen.findByText('Showing 1 of 4 members.')).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent(coordinatorMember.fullName ?? '');

    await user.selectOptions(screen.getByLabelText('Role'), 'volunteer');
    expect(rows()).toHaveLength(2);
    expect(router.state.location.search).toBe('?role=volunteer');

    await user.selectOptions(screen.getByLabelText('Role'), '');
    expect(rows()).toHaveLength(4);
    expect(router.state.location.search).toBe('');
  });

  it('ignores an unknown role in the URL', async () => {
    server.use(memberHandlers.list(testMembers));
    renderRoster({ route: '/members?role=boss' });

    await screen.findByRole('heading', { name: 'Members (4)' });
    expect(rows()).toHaveLength(4);
  });

  it('explains when nothing matches and clears the filters', async () => {
    server.use(memberHandlers.list(testMembers));
    const { user } = renderRoster({ route: '/members?q=nobody' });

    expect(await screen.findByText('No members match your search.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(rows()).toHaveLength(4);
  });
});

describe('MemberRoster: managing members', () => {
  it('offers each member every other role, and removal for others only', async () => {
    server.use(memberHandlers.list(testMembers));
    const { user } = renderRoster();

    const menu = await openMenu(user, 'Manage Jordan Lee');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Make owner', 'Make coordinator', 'Remove from organization']);

    await user.keyboard('{Escape}');
    const ownMenu = await openMenu(user, 'Manage your role');
    expect(within(ownMenu).queryByRole('menuitem', { name: /Remove/ })).not.toBeInTheDocument();
  });

  it('promotes a volunteer to coordinator immediately', async () => {
    const store = rosterStore(testMembers);
    let request: MembershipRequest | undefined;
    server.use(
      memberHandlers.updateOk((req) => {
        request = req;
        store.set([meAsOwner, coordinatorMember, { ...volunteerMember, role: 'coordinator' }]);
      }),
    );
    const { user } = renderRoster();

    const menu = await openMenu(user, 'Manage Jordan Lee');
    await user.click(within(menu).getByRole('menuitem', { name: 'Make coordinator' }));

    expect(await screen.findByText('Jordan Lee is now a coordinator.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(request).toEqual({
      orgId: testOrg.id,
      userId: volunteerMember.userId,
      body: { role: 'coordinator' },
    });
  });

  it('confirms before making someone an owner', async () => {
    let request: MembershipRequest | undefined;
    server.use(
      memberHandlers.list(testMembers),
      memberHandlers.updateOk((req) => {
        request = req;
      }),
    );
    const { user } = renderRoster();

    const menu = await openMenu(user, 'Manage Alex Kim');
    await user.click(within(menu).getByRole('menuitem', { name: 'Make owner' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Make Alex Kim an owner?' });
    expect(request).toBeUndefined();
    await user.click(within(dialog).getByRole('button', { name: 'Make owner' }));

    expect(await screen.findByText('Alex Kim is now an owner.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(request?.body).toEqual({ role: 'owner' });
  });

  it('changes nothing when the confirmation is cancelled, and returns focus', async () => {
    let requested = false;
    server.use(
      memberHandlers.list(testMembers),
      memberHandlers.updateOk(() => {
        requested = true;
      }),
    );
    const { user } = renderRoster();

    const menu = await openMenu(user, 'Manage Alex Kim');
    await user.click(within(menu).getByRole('menuitem', { name: 'Make volunteer' }));
    await screen.findByRole('alertdialog', { name: 'Change Alex Kim to volunteer?' });
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Alex Kim' })).toHaveFocus();
    expect(requested).toBe(false);
  });

  it('removes a member after confirming, then moves focus to the list heading', async () => {
    const store = rosterStore(testMembers);
    let request: MembershipRequest | undefined;
    server.use(
      memberHandlers.removeOk((req) => {
        request = req;
        store.set([meAsOwner, coordinatorMember, unnamedMember]);
      }),
    );
    const { user } = renderRoster();

    const menu = await openMenu(user, 'Manage Jordan Lee');
    await user.click(within(menu).getByRole('menuitem', { name: 'Remove from organization' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove Jordan Lee?' });
    expect(dialog).toHaveTextContent('lose access to Riverside Food Bank');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('Jordan Lee was removed.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Members (3)' })).toHaveFocus();
    expect(request).toEqual({ orgId: testOrg.id, userId: volunteerMember.userId });
  });

  it('explains inside the dialog why the last owner cannot step down', async () => {
    server.use(memberHandlers.list(testMembers), memberHandlers.updateFails('LAST_OWNER'));
    const { user } = renderRoster();

    const menu = await openMenu(user, 'Manage your role');
    await user.click(within(menu).getByRole('menuitem', { name: 'Make coordinator' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Step down to coordinator?' });
    await user.click(within(dialog).getByRole('button', { name: 'Step down' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'An organization needs at least one owner.',
    );
    expect(dialog).toBeInTheDocument();
  });

  it('reports a change the database silently refused', async () => {
    server.use(memberHandlers.list(testMembers), memberHandlers.updateNoRows());
    const { user } = renderRoster();

    const menu = await openMenu(user, 'Manage Jordan Lee');
    await user.click(within(menu).getByRole('menuitem', { name: 'Make coordinator' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "You don't have permission to do that.",
    );
  });

  it('has no detectable accessibility violations, including with a dialog open', async () => {
    server.use(memberHandlers.list(testMembers));
    const { container, user } = renderRoster();

    await screen.findByRole('heading', { name: 'Members (4)' });
    expect(await axe(container)).toHaveNoViolations();

    const menu = await openMenu(user, 'Manage Jordan Lee');
    await user.click(within(menu).getByRole('menuitem', { name: 'Remove from organization' }));
    await screen.findByRole('alertdialog');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
