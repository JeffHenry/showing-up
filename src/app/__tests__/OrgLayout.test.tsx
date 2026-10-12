import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import { otherTestOrg, testOrg } from '@/test/fixtures/orgs';
import { orgHandlers, REST_URL } from '@/test/msw/orgs';
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
    // Eastside Pantry has no optional details, so there's no About card.
    expect(screen.queryByRole('heading', { name: 'About' })).not.toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    server.use(orgHandlers.list([otherTestOrg, testOrg]));
    const { container } = renderOrg();

    await screen.findByRole('heading', { level: 1, name: 'Riverside Food Bank' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
