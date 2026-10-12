import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { delay, http, HttpResponse } from 'msw';
import { useParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CreateOrgPage } from '@/features/orgs/components/CreateOrgPage';
import { OrgsPage } from '@/features/orgs/components/OrgsPage';
import { testOrg } from '@/test/fixtures/orgs';
import { orgHandlers, REST_URL } from '@/test/msw/orgs';
import { server } from '@/test/msw/server';
import { renderRoutes } from '@/test/render';

function OrgProbe() {
  const { orgId } = useParams();
  return <h1>Dashboard for {orgId}</h1>;
}

const routes = [
  { path: '/orgs', element: <h1>Organization list</h1> },
  { path: '/orgs/new', element: <CreateOrgPage /> },
  { path: '/orgs/:orgId', element: <OrgProbe /> },
];

function renderCreate() {
  return renderRoutes(routes, { route: '/orgs/new', auth: 'signedIn' });
}

type User = ReturnType<typeof renderCreate>['user'];

async function fillRequired(user: User, name = 'Riverside Food Bank') {
  await user.type(screen.getByLabelText('Name'), name);
  await user.selectOptions(screen.getByLabelText('Time zone'), 'America/Chicago');
}

async function submit(user: User) {
  await user.click(screen.getByRole('button', { name: 'Create organization' }));
}

describe('CreateOrgPage', () => {
  it('fills in the short name from the name until the user edits it', async () => {
    const { user } = renderCreate();
    const name = screen.getByLabelText('Name');
    const slug = screen.getByLabelText('Short name');

    await user.type(name, 'Café Société');
    expect(slug).toHaveValue('cafe-societe');

    await user.clear(slug);
    await user.type(slug, 'my-cafe');
    await user.type(name, ' Downtown');
    expect(slug).toHaveValue('my-cafe');

    // Clearing the short name hands it back to the name.
    await user.clear(slug);
    await user.type(name, '!');
    expect(slug).toHaveValue('cafe-societe-downtown');
  });

  it('explains missing and invalid details next to each field', async () => {
    const { user } = renderCreate();

    await submit(user);

    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(
      'Enter a name for your organization.',
    );
    expect(screen.getByLabelText('Short name')).toHaveAccessibleDescription(
      'A unique handle: lowercase letters, numbers, and hyphens. Use at least 3 characters.',
    );

    await user.type(screen.getByLabelText('Short name'), 'bad--slug');
    await user.type(screen.getByLabelText('Contact email'), 'not-an-email');
    await user.type(screen.getByLabelText('Website'), 'javascript:alert(1)');
    await submit(user);

    expect(screen.getByLabelText('Short name')).toHaveAccessibleDescription(
      /Use only letters, numbers, and single hyphens/,
    );
    expect(screen.getByLabelText('Contact email')).toHaveAccessibleDescription(
      'Enter a valid email address, like hello@example.org.',
    );
    expect(screen.getByLabelText('Website')).toHaveAccessibleDescription(
      'Enter a full web address, like https://example.org.',
    );
  });

  it('creates the organization with trimmed details, leaving blank ones out', async () => {
    let body: unknown;
    server.use(
      orgHandlers.createOk(testOrg, (requestBody) => {
        body = requestBody;
      }),
    );
    const { user } = renderCreate();

    await fillRequired(user, '  Riverside Food Bank  ');
    await submit(user);

    expect(
      await screen.findByRole('heading', { name: `Dashboard for ${testOrg.id}` }),
    ).toBeInTheDocument();
    expect(body).toEqual({
      p_name: 'Riverside Food Bank',
      p_slug: 'riverside-food-bank',
      p_timezone: 'America/Chicago',
    });
  });

  it('sends the optional About details when filled in', async () => {
    let body: unknown;
    server.use(
      orgHandlers.createOk(testOrg, (requestBody) => {
        body = requestBody;
      }),
    );
    const { user } = renderCreate();

    await fillRequired(user);
    await user.type(screen.getByLabelText('Description'), 'Feeding families.');
    await user.type(screen.getByLabelText('Contact email'), ' hello@riverside.example ');
    await user.type(screen.getByLabelText('Website'), 'https://riverside.example');
    expect(screen.getByLabelText('Description')).toHaveAccessibleDescription(
      '17 of 500 characters',
    );
    await submit(user);

    await screen.findByRole('heading', { name: `Dashboard for ${testOrg.id}` });
    expect(body).toMatchObject({
      p_description: 'Feeding families.',
      p_contact_email: 'hello@riverside.example',
      p_website_url: 'https://riverside.example',
    });
  });

  it('refreshes the cached organization list before opening the new organization', async () => {
    let listRequests = 0;
    server.use(
      orgHandlers.createOk(testOrg),
      http.get(`${REST_URL}/organizations`, () => {
        listRequests += 1;
        return HttpResponse.json([]);
      }),
    );
    // Start on the real list page, so the list is cached but no page shows it during creation.
    const { user } = renderRoutes(
      [
        ...routes.filter((route) => route.path !== '/orgs'),
        { path: '/orgs', element: <OrgsPage /> },
      ],
      { route: '/orgs', auth: 'signedIn' },
    );
    await user.click(await screen.findByRole('link', { name: 'Create an organization' }));
    expect(listRequests).toBe(1);

    await fillRequired(user);
    await submit(user);

    await screen.findByRole('heading', { name: `Dashboard for ${testOrg.id}` });
    expect(listRequests).toBe(2);
  });

  it('flags a short name that is already taken on that field', async () => {
    server.use(orgHandlers.createFails('SLUG_TAKEN'));
    const { user } = renderCreate();

    await fillRequired(user);
    await submit(user);

    await screen.findByText(/Another organization already uses that short name/);
    const slug = screen.getByLabelText('Short name');
    expect(slug).toHaveAccessibleDescription(/Another organization already uses that short name/);
    expect(slug).toHaveAttribute('aria-invalid', 'true');
    expect(slug).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains the creation limit', async () => {
    server.use(orgHandlers.createFails('ORG_LIMIT_REACHED'));
    const { user } = renderCreate();

    await fillRequired(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "You've already created the maximum of 2 organizations.",
    );
  });

  it('disables the button while creating', async () => {
    server.use(
      http.post(`${REST_URL}/rpc/create_organization`, async () => {
        await delay(50);
        return HttpResponse.json({ id: testOrg.id });
      }),
    );
    const { user } = renderCreate();

    await fillRequired(user);
    await submit(user);

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    await screen.findByRole('heading', { name: `Dashboard for ${testOrg.id}` });
  });

  it('can be cancelled', async () => {
    const { user } = renderCreate();

    await user.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(await screen.findByRole('heading', { name: 'Organization list' })).toBeInTheDocument();
  });

  // One scan with errors showing covers the plain form too. axe walks all ~400 time zone options,
  // which is slow under coverage instrumentation, hence the longer timeout.
  it(
    'has no detectable accessibility violations with errors shown',
    { timeout: 15_000 },
    async () => {
      const { container, user } = renderCreate();

      await submit(user);

      expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
