import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import { otherTestOrg, testOrg } from '@/test/fixtures/orgs';
import { inviteHandlers } from '@/test/msw/invites';
import { orgHandlers } from '@/test/msw/orgs';
import { REST_URL } from '@/test/msw/rest';
import { server } from '@/test/msw/server';
import { renderRoutes } from '@/test/render';

// The real route tree, so these cover OrgLayout, OrgContext, the dashboard, and the switcher together.
function renderOrg(orgId = testOrg.id) {
  return renderRoutes(routes, { route: `/orgs/${orgId}`, auth: 'signedIn' });
}

describe('organization pages', () => {
  it('shows the organization, the user’s role, and its details', async () => {
    server.use(orgHandlers.list([otherTestOrg, testOrg]));
    renderOrg();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Riverside Food Bank' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Your role: Owner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invite people' })).toHaveAttribute(
      'href',
      `/orgs/${testOrg.id}/members#invite`,
    );
    expect(screen.getByRole('link', { name: 'New shift' })).toHaveAttribute(
      'href',
      `/orgs/${testOrg.id}/shifts/new`,
    );
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByText('Feeding families since 1998.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hello@riverside.example' })).toHaveAttribute(
      'href',
      'mailto:hello@riverside.example',
    );
    expect(screen.getByRole('link', { name: 'riverside.example' })).toHaveAttribute(
      'href',
      'https://www.riverside.example/about',
    );
    await waitFor(() => {
      expect(document.title).toBe('Riverside Food Bank · ShowingUp');
    });
  });

  it('shows a loading state while the organization loads', async () => {
    server.use(
      http.get(`${REST_URL}/organizations`, async () => {
        await delay(50);
        return HttpResponse.json([]);
      }),
    );
    renderOrg();

    expect(await screen.findByText('Loading organization…')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Organization not found' }),
    ).toBeInTheDocument();
  });

  it('gives the same not-found answer for unknown organizations and non-members', async () => {
    server.use(orgHandlers.list([testOrg]));
    const { user } = renderOrg(otherTestOrg.id);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Organization not found' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/you might not be a member/)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Your organizations' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your organizations' }),
    ).toBeInTheDocument();
  });

  it('explains a failed load and retries', async () => {
    server.use(orgHandlers.listFails());
    const { user } = renderOrg();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load this organization",
    );

    server.use(orgHandlers.list([testOrg]));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Riverside Food Bank' }),
    ).toBeInTheDocument();
  });

  it('switches to another organization from the switcher', async () => {
    server.use(orgHandlers.list([otherTestOrg, testOrg]));
    const { user } = renderOrg();

    await user.click(
      await screen.findByRole('button', {
        name: 'Switch organization. Current: Riverside Food Bank',
      }),
    );
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Riverside Food Bank' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(menu).getByRole('menuitem', { name: 'All organizations' })).toHaveAttribute(
      'href',
      '/orgs',
    );
    expect(within(menu).getByRole('menuitem', { name: 'New organization' })).toHaveAttribute(
      'href',
      '/orgs/new',
    );

    await user.click(within(menu).getByRole('menuitem', { name: 'Eastside Pantry' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Eastside Pantry' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Your role: Volunteer')).toBeInTheDocument();
    // Volunteers can't invite or see the roster, so neither is offered.
    expect(screen.queryByRole('link', { name: 'Invite people' })).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Organization' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Overview', 'Shifts']);
    // Volunteers browse shifts but don't create them.
    expect(screen.getByRole('link', { name: 'View shifts' })).toHaveAttribute(
      'href',
      `/orgs/${otherTestOrg.id}/shifts`,
    );
    expect(screen.queryByRole('link', { name: 'New shift' })).not.toBeInTheDocument();
    // Eastside Pantry has no optional details, so there's no About card.
    expect(screen.queryByRole('heading', { name: 'About' })).not.toBeInTheDocument();
  });

  it('offers Overview, Shifts, and Members in the organization navigation', async () => {
    server.use(orgHandlers.list([testOrg]), inviteHandlers.pending([]));
    const { user } = renderOrg();

    const nav = await screen.findByRole('navigation', { name: 'Organization' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Overview', 'Shifts', 'Members']);
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(within(nav).getByRole('link', { name: 'Members' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Members' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('takes "Invite people" on the dashboard straight to the invite section', async () => {
    server.use(orgHandlers.list([testOrg]), inviteHandlers.pending([]));
    const { user } = renderOrg();

    await user.click(await screen.findByRole('link', { name: 'Invite people' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Invite people' })).toHaveFocus();
  });

  it('keeps volunteers out of the Members page', async () => {
    server.use(orgHandlers.list([otherTestOrg]));
    renderRoutes(routes, { route: `/orgs/${otherTestOrg.id}/members`, auth: 'signedIn' });

    expect(
      await screen.findByRole('heading', { name: "You don't have access to this page" }),
    ).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    server.use(orgHandlers.list([otherTestOrg, testOrg]));
    const { container } = renderOrg();

    await screen.findByRole('heading', { level: 1, name: 'Riverside Food Bank' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
