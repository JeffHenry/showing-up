import { screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import type { MyOrganization } from '@/features/orgs/types';
import { testUser } from '@/test/fixtures/auth';
import { otherTestOrg, testOrg } from '@/test/fixtures/orgs';
import { memberHandlers, type MembershipRequest } from '@/test/msw/members';
import { REST_URL } from '@/test/msw/rest';
import { server } from '@/test/msw/server';
import { renderRoutes } from '@/test/render';

/** The real route tree, with a membership list the test can change when someone leaves. */
function renderDashboard(initialOrgs: MyOrganization[]) {
  let myOrgs = initialOrgs;
  server.use(
    http.get(`${REST_URL}/organizations`, () =>
      HttpResponse.json(myOrgs.map(({ role, ...org }) => ({ ...org, memberships: [{ role }] }))),
    ),
  );
  const view = renderRoutes(routes, { route: `/orgs/${testOrg.id}`, auth: 'signedIn' });
  return {
    ...view,
    setOrgs: (next: MyOrganization[]) => {
      myOrgs = next;
    },
  };
}

type User = ReturnType<typeof renderDashboard>['user'];

async function startLeaving(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Leave organization' }));
  return screen.findByRole('alertdialog', { name: `Leave ${testOrg.name}?` });
}

describe('leaving an organization', () => {
  it('confirms, leaves, and lands on the organization list with a confirmation', async () => {
    let request: MembershipRequest | undefined;
    const { user, setOrgs } = renderDashboard([testOrg, otherTestOrg]);
    server.use(
      memberHandlers.removeOk((req) => {
        request = req;
        setOrgs([otherTestOrg]);
      }),
    );

    const dialog = await startLeaving(user);
    expect(dialog).toHaveTextContent(
      "You'll lose access until someone invites you again, and your upcoming shift signups there are cancelled.",
    );
    await user.click(within(dialog).getByRole('button', { name: 'Leave' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your organizations' }),
    ).toBeInTheDocument();
    expect(screen.getByText(`You left ${testOrg.name}.`)).toBeInTheDocument();
    expect(await screen.findAllByRole('link', { name: /Eastside Pantry/ })).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /Riverside Food Bank/ })).not.toBeInTheDocument();
    expect(request).toEqual({ orgId: testOrg.id, userId: testUser.id });
  });

  it('tells the last owner to make someone else an owner first', async () => {
    const { user } = renderDashboard([testOrg]);
    server.use(memberHandlers.removeFails('LAST_OWNER'));

    const dialog = await startLeaving(user);
    await user.click(within(dialog).getByRole('button', { name: 'Leave' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'An organization needs at least one owner. Make someone else an owner first.',
    );
  });

  it('stays put when cancelled, returning focus to the button', async () => {
    const { user } = renderDashboard([testOrg]);

    const dialog = await startLeaving(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave organization' })).toHaveFocus();
  });

  it('has no detectable accessibility violations with the dialog open', async () => {
    const { user } = renderDashboard([testOrg]);

    await startLeaving(user);
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
