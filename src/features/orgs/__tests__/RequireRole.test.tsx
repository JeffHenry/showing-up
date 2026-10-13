import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import type { MembershipRole } from '@/context/orgContext';
import { RequireRole } from '@/features/orgs/components/RequireRole';
import { testOrg } from '@/test/fixtures/orgs';
import { renderRoutes } from '@/test/render';

function renderGuarded(role: MembershipRole) {
  return renderRoutes(
    [
      {
        element: <RequireRole roles={['owner', 'coordinator']} />,
        children: [{ path: '/members', element: <h1>Members page</h1> }],
      },
      { path: '/orgs/:orgId', element: <h1>Organization dashboard</h1> },
    ],
    { route: '/members', auth: 'signedIn', org: role },
  );
}

describe('RequireRole', () => {
  it.each([['owner'], ['coordinator']] as const)('lets a %s through', (role) => {
    renderGuarded(role);

    expect(screen.getByRole('heading', { name: 'Members page' })).toBeInTheDocument();
  });

  it('tells other roles they lack access and offers a way back', async () => {
    const { user } = renderGuarded('volunteer');

    expect(
      screen.getByRole('heading', { name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Members page' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: `Back to ${testOrg.name}` }));

    expect(
      await screen.findByRole('heading', { name: 'Organization dashboard' }),
    ).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderGuarded('volunteer');

    expect(await axe(container)).toHaveNoViolations();
  });
});
