import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { http, HttpResponse } from 'msw';
import type { InitialEntry } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import { SIGNED_IN_STATE } from '@/lib/redirects';
import { testUser } from '@/test/fixtures/auth';
import { testOrg } from '@/test/fixtures/orgs';
import { createGate } from '@/test/gate';
import { orgHandlers } from '@/test/msw/orgs';
import { profileHandlers, testUserName } from '@/test/msw/profiles';
import { REST_URL } from '@/test/msw/rest';
import { server } from '@/test/msw/server';
import { renderRoutes } from '@/test/render';

// The real route tree, so RequireName, the welcome step, and the destination work together.
function renderAs(route: InitialEntry) {
  return renderRoutes(routes, { route, auth: 'signedIn' });
}

async function saveName(user: ReturnType<typeof renderAs>['user'], name: string) {
  await user.type(await screen.findByLabelText('Your name'), name);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('display name step', () => {
  it('asks a person without a name for one before showing their organizations', async () => {
    server.use(profileHandlers.mine(null));
    const { router } = renderAs('/orgs');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'What should we call you?' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/welcome');
    expect(new URLSearchParams(router.state.location.search).get('next')).toBe('/orgs');
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(
      'Shown to people in your organizations.',
    );
  });

  it('saves the trimmed name and continues to where the person was headed', async () => {
    let body: unknown;
    server.use(
      profileHandlers.mine(null),
      profileHandlers.updateOk((requestBody) => {
        body = requestBody;
      }),
    );
    const { user } = renderAs('/orgs');

    await saveName(user, '  Jordan Lee  ');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your organizations' }),
    ).toBeInTheDocument();
    expect(body).toEqual({ full_name: 'Jordan Lee' });
  });

  it('still opens the only organization after naming yourself straight after sign-in', async () => {
    server.use(profileHandlers.mine(null), profileHandlers.updateOk(), orgHandlers.list([testOrg]));
    const { user } = renderAs({ pathname: '/orgs', state: SIGNED_IN_STATE });

    await saveName(user, 'Jordan Lee');

    expect(
      await screen.findByRole('heading', { level: 1, name: testOrg.name }),
    ).toBeInTheDocument();
  });

  it('explains a missing name', async () => {
    server.use(profileHandlers.mine(null));
    const { user } = renderAs('/orgs');

    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    await screen.findByText('Enter your name.');
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(
      'Shown to people in your organizations. Enter your name.',
    );
  });

  it('disables the button while saving', async () => {
    const gate = createGate();
    server.use(
      profileHandlers.mine(null),
      http.patch(`${REST_URL}/profiles`, async () => {
        await gate.opened;
        return HttpResponse.json({ id: testUser.id, full_name: 'Jordan Lee' });
      }),
    );
    const { user } = renderAs('/orgs');

    await saveName(user, 'Jordan Lee');

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    gate.open();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your organizations' }),
    ).toBeInTheDocument();
  });

  it('explains a name the database rejects', async () => {
    server.use(profileHandlers.mine(null), profileHandlers.updateFails('23514', 'check violation'));
    const { user } = renderAs('/orgs');

    await saveName(user, 'Jordan Lee');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Some of those details weren't accepted.",
    );
  });

  it('skips the step for someone who already has a name', async () => {
    renderAs('/welcome?next=%2Forgs');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your organizations' }),
    ).toBeInTheDocument();
  });

  it('offers a retry when the profile cannot be loaded', async () => {
    server.use(profileHandlers.mineFails());
    const { user } = renderAs('/orgs');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your profile");

    server.use(profileHandlers.mine(testUserName));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your organizations' }),
    ).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    server.use(profileHandlers.mine(null));
    const { container } = renderAs('/orgs');

    await screen.findByRole('heading', { level: 1, name: 'What should we call you?' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
