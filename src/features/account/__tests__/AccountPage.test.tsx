import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import { testUser } from '@/test/fixtures/auth';
import { profileHandlers, testUserName } from '@/test/msw/profiles';
import { server } from '@/test/msw/server';
import { renderRoutes } from '@/test/render';

function renderAccount(route = '/account') {
  return renderRoutes(routes, { route, auth: 'signedIn' });
}

describe('AccountPage', () => {
  it('is reachable from the header', async () => {
    const { user } = renderAccount('/orgs');

    await user.click(await screen.findByRole('link', { name: 'Account' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument();
  });

  it('shows the current name and the sign-in email', async () => {
    renderAccount();

    expect(await screen.findByLabelText('Your name')).toHaveValue(testUserName);
    expect(screen.getByRole('heading', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByText(String(testUser.email), { selector: 'p' })).toBeInTheDocument();
  });

  it('saves a new name and confirms it', async () => {
    let body: unknown;
    server.use(
      profileHandlers.updateOk((requestBody) => {
        body = requestBody;
      }),
    );
    const { user } = renderAccount();
    const name = await screen.findByLabelText('Your name');

    await user.clear(name);
    await user.type(name, 'Jordan Lee');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText('Name saved.')).toBeInTheDocument();
    expect(body).toEqual({ full_name: 'Jordan Lee' });
  });

  it('will not save an empty name', async () => {
    const { user } = renderAccount();

    await user.clear(await screen.findByLabelText('Your name'));
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText('Enter your name.')).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderAccount();

    await screen.findByLabelText('Your name');
    expect(await axe(container)).toHaveNoViolations();
  });
});
