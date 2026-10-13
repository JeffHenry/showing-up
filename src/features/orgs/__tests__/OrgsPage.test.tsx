import { screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { OrgsPage } from '@/features/orgs/components/OrgsPage';
import { ENTRY_STATE } from '@/lib/redirects';
import { testUser } from '@/test/fixtures/auth';
import { otherTestOrg, testOrg } from '@/test/fixtures/orgs';
import { orgHandlers } from '@/test/msw/orgs';
import { REST_URL } from '@/test/msw/rest';
import { server } from '@/test/msw/server';
import { renderRoutes } from '@/test/render';
import type { InitialEntry } from 'react-router';

const routes = [
  { path: '/orgs', element: <OrgsPage /> },
  { path: '/orgs/new', element: <h1>New organization form</h1> },
  { path: '/orgs/:orgId', element: <h1>Organization dashboard</h1> },
];

function renderOrgs(route: InitialEntry = '/orgs') {
  return renderRoutes(routes, { route, auth: 'signedIn' });
}

describe('OrgsPage', () => {
  it('shows a loading state while organizations load', async () => {
    server.use(
      http.get(`${REST_URL}/organizations`, async () => {
        await delay(50);
        return HttpResponse.json([]);
      }),
    );
    renderOrgs();

    expect(await screen.findByText('Loading your organizations…')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: "You're not in any organizations yet" }),
    ).toBeInTheDocument();
  });

  it('guides a new user to create an organization or ask for an invite', async () => {
    const { user } = renderOrgs();

    expect(
      await screen.findByRole('heading', { name: "You're not in any organizations yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ask its coordinator for an invite link/)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Create an organization' }));

    expect(
      await screen.findByRole('heading', { name: 'New organization form' }),
    ).toBeInTheDocument();
  });

  it('lists organizations with the role in each, linking to each one', async () => {
    server.use(orgHandlers.list([otherTestOrg, testOrg]));
    const { user } = renderOrgs();

    const list = await screen.findByRole('list');
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('Eastside PantryVolunteer');
    expect(links[1]).toHaveTextContent('Riverside Food BankOwner');
    expect(links[1]).toHaveTextContent('Feeding families since 1998.');
    expect(screen.getByRole('link', { name: 'New organization' })).toHaveAttribute(
      'href',
      '/orgs/new',
    );

    await user.click(within(list).getByRole('link', { name: /Riverside Food Bank/ }));

    expect(
      await screen.findByRole('heading', { name: 'Organization dashboard' }),
    ).toBeInTheDocument();
  });

  it('asks only for the signed-in user’s memberships, sorted by name', async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`${REST_URL}/organizations`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json([]);
      }),
    );
    renderOrgs();

    await screen.findByRole('heading', { name: "You're not in any organizations yet" });
    const params = requests[0]?.searchParams;
    expect(params?.get('memberships.user_id')).toBe(`eq.${testUser.id}`);
    expect(params?.get('select')).toContain('memberships!inner(role)');
    expect(params?.get('order')).toBe('name.asc');
  });

  it('explains a failed load and retries', async () => {
    server.use(orgHandlers.listFails());
    const { user } = renderOrgs();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load your organizations",
    );

    server.use(orgHandlers.list([testOrg]));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: /Riverside Food Bank/ })).toBeInTheDocument();
  });

  it('opens the only organization straight after signing in', async () => {
    server.use(orgHandlers.list([testOrg]));
    renderOrgs({ pathname: '/orgs', state: ENTRY_STATE });

    expect(
      await screen.findByRole('heading', { name: 'Organization dashboard' }),
    ).toBeInTheDocument();
  });

  it('shows the list after signing in when there are several organizations', async () => {
    server.use(orgHandlers.list([otherTestOrg, testOrg]));
    renderOrgs({ pathname: '/orgs', state: ENTRY_STATE });

    expect(await screen.findAllByRole('link', { name: /Pantry|Food Bank/ })).toHaveLength(2);
  });

  it('shows the list, not a redirect, when visited directly with one organization', async () => {
    server.use(orgHandlers.list([testOrg]));
    renderOrgs();

    expect(await screen.findByRole('link', { name: /Riverside Food Bank/ })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your organizations' }),
    ).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    server.use(orgHandlers.list([otherTestOrg, testOrg]));
    const { container } = renderOrgs();

    await screen.findByRole('list');
    expect(await axe(container)).toHaveNoViolations();
  });
});
