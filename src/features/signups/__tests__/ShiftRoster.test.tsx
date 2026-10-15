import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import type { ShiftDetail } from '@/features/shifts/types';
import type { ShiftSignup } from '@/features/signups/types';
import { testUser } from '@/test/fixtures/auth';
import { testOrg } from '@/test/fixtures/orgs';
import { cancelledShift, testShift } from '@/test/fixtures/shifts';
import { createGate } from '@/test/gate';
import { orgHandlers } from '@/test/msw/orgs';
import { REST_URL, restError } from '@/test/msw/rest';
import { server } from '@/test/msw/server';
import { shiftHandlers } from '@/test/msw/shifts';
import { signupHandlers } from '@/test/msw/signups';
import { renderRoutes } from '@/test/render';

// "Who's coming" on a shift's page, through the real route tree. In Chicago time (the test
// organization's zone), 03:00 UTC on Oct 2 is still Oct 1.
const sam: ShiftSignup = {
  userId: '00000000-0000-0000-0000-0000000000d3',
  fullName: 'Sam Volunteer',
  signedUpAt: '2099-10-02T03:00:00+00:00',
};
const me: ShiftSignup = {
  userId: testUser.id,
  fullName: 'Taylor Tester',
  signedUpAt: '2099-10-03T15:00:00+00:00',
};
const unnamed: ShiftSignup = {
  userId: '00000000-0000-0000-0000-0000000000d4',
  fullName: null,
  signedUpAt: '2099-10-04T15:00:00+00:00',
};

function renderShift(
  signups: ShiftSignup[],
  { shift = testShift, role = 'owner' }: { shift?: ShiftDetail; role?: 'owner' | 'volunteer' } = {},
) {
  server.use(
    orgHandlers.list([{ ...testOrg, role }]),
    shiftHandlers.detail(shift),
    signupHandlers.list(signups),
  );
  return renderRoutes(routes, {
    route: `/orgs/${testOrg.id}/shifts/${shift.id}`,
    auth: 'signedIn',
  });
}

async function roster() {
  return screen.findByRole('region', { name: /^Who’s coming/ });
}

describe('ShiftRoster', () => {
  it('lists who’s coming, with when each person signed up', async () => {
    const requests: URLSearchParams[] = [];
    renderShift([sam, me, unnamed]);
    // Registered after rendering, so it takes priority over renderShift's own list handler.
    server.use(signupHandlers.list([sam, me, unnamed], (params) => requests.push(params)));

    const list = await roster();
    expect(
      await within(list).findByRole('heading', { level: 2, name: 'Who’s coming (3)' }),
    ).toBeInTheDocument();
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Sam VolunteerSigned up Oct 1, 2099');
    expect(items[1]).toHaveTextContent('Taylor Tester (you)');
    expect(items[2]).toHaveTextContent('Unnamed member');
    // Your own signup is dropped with Drop out, not removed here.
    expect(
      within(list)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Remove Sam Volunteer', 'Remove Unnamed member']);
    expect(requests[0]?.get('shift_id')).toBe(`eq.${testShift.id}`);
    expect(requests[0]?.get('status')).toBe('eq.confirmed');
  });

  it('removes someone after confirming, freeing their spot', async () => {
    let body: unknown;
    server.use(signupHandlers.cancelOk((sent) => (body = sent)));
    const { user } = renderShift([sam, me]);

    const list = await roster();
    await user.click(await within(list).findByRole('button', { name: 'Remove Sam Volunteer' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Remove Sam Volunteer from “Morning sorting”?',
    });
    // What the page reloads once the removal succeeds.
    server.use(
      signupHandlers.list([me]),
      shiftHandlers.detail({ ...testShift, confirmed_count: 1 }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(
      await within(list).findByText('Removed Sam Volunteer from the shift.'),
    ).toBeInTheDocument();
    expect(body).toEqual({ p_shift_id: testShift.id, p_user_id: sam.userId });
    expect(within(list).queryByText('Sam Volunteer')).not.toBeInTheDocument();
    // The row (and its button) went away, so focus moves to the list's heading.
    await waitFor(() => {
      expect(within(list).getByRole('heading', { name: 'Who’s coming (1)' })).toHaveFocus();
    });
    expect(screen.getByRole('region', { name: 'Volunteer spots' })).toHaveTextContent(
      '1 of 6 spots filled · 5 left',
    );
  });

  it('keeps them when the dialog is dismissed, returning focus to the button', async () => {
    const { user } = renderShift([sam]);

    const list = await roster();
    const remove = await within(list).findByRole('button', { name: 'Remove Sam Volunteer' });
    await user.click(remove);
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Keep them' }));

    await waitFor(() => {
      expect(remove).toHaveFocus();
    });
    expect(within(list).getByText('Sam Volunteer')).toBeInTheDocument();
  });

  it('shows progress, then a refusal inside the dialog', async () => {
    const gate = createGate();
    server.use(signupHandlers.cancelFails('SHIFT_STARTED', 'P0001', () => gate.opened));
    const { user } = renderShift([sam]);

    const list = await roster();
    await user.click(await within(list).findByRole('button', { name: 'Remove Sam Volunteer' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(await within(dialog).findByRole('button', { name: 'Removing…' })).toBeDisabled();
    gate.open();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "This shift has already started, so it can't be changed.",
    );
  });

  it('says when no one has signed up yet', async () => {
    renderShift([]);

    expect(
      await within(await roster()).findByText('No one has signed up yet.'),
    ).toBeInTheDocument();
  });

  it('explains a failed load and retries', async () => {
    const gate = createGate();
    const { user } = renderShift([sam]);
    server.use(
      http.get(`${REST_URL}/signups`, async () => {
        await gate.opened;
        return restError(500, 'XX000', 'internal error');
      }),
    );

    const list = await roster();
    expect(await within(list).findByText('Loading who’s coming…')).toBeInTheDocument();
    gate.open();
    expect(await within(list).findByRole('alert')).toHaveTextContent(
      "We couldn't load who's coming",
    );

    server.use(signupHandlers.list([sam]));
    await user.click(within(list).getByRole('button', { name: 'Try again' }));
    expect(await within(list).findByText('Sam Volunteer')).toBeInTheDocument();
  });

  it.each([
    [
      'has started',
      {
        ...testShift,
        start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    ],
    ['was cancelled', { ...cancelledShift, confirmed_count: 1 }],
  ])('lists people without removing anyone once the shift %s', async (_label, shift) => {
    renderShift([sam], { shift });

    const list = await roster();
    expect(await within(list).findByText('Sam Volunteer')).toBeInTheDocument();
    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
  });

  it('isn’t shown to volunteers', async () => {
    renderShift([sam], { role: 'volunteer' });

    await screen.findByRole('region', { name: 'Volunteer spots' });
    expect(screen.queryByRole('region', { name: /^Who’s coming/ })).not.toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderShift([sam, me]);

    await within(await roster()).findByText('Sam Volunteer');
    expect(await axe(container)).toHaveNoViolations();
  });
});
