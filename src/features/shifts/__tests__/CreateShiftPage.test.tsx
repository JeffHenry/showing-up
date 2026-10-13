import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import { testOrg } from '@/test/fixtures/orgs';
import { afternoonShift, summaryOf, testShift } from '@/test/fixtures/shifts';
import { createGate } from '@/test/gate';
import { orgHandlers } from '@/test/msw/orgs';
import { REST_URL } from '@/test/msw/rest';
import { server } from '@/test/msw/server';
import { shiftHandlers } from '@/test/msw/shifts';
import { renderRoutes } from '@/test/render';
import { wallTimeAt, zonedInstant } from '@/lib/zonedTime';

const CHICAGO = testOrg.timezone;

/** A date a few days ahead in the organization's zone, so it's always in the future. */
const date = wallTimeAt(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), CHICAGO).date;

function renderCreate(role: 'owner' | 'volunteer' = 'owner', search = '') {
  server.use(orgHandlers.list([{ ...testOrg, role }]));
  return renderRoutes(routes, {
    route: `/orgs/${testOrg.id}/shifts/new${search}`,
    auth: 'signedIn',
  });
}

type User = ReturnType<typeof renderCreate>['user'];

async function fill(user: User, label: string, text: string) {
  await user.click(screen.getByLabelText(label));
  await user.paste(text);
}

async function fillShift(user: User, { startTime = '09:00', endTime = '12:00' } = {}) {
  await fill(user, 'Title', 'Morning sorting');
  await user.type(screen.getByLabelText('Date'), date);
  await user.type(screen.getByLabelText('Start time'), startTime);
  await user.type(screen.getByLabelText('End time'), endTime);
  await fill(user, 'Volunteers needed', '6');
}

async function submit(user: User) {
  await user.click(screen.getByRole('button', { name: 'Create shift' }));
}

describe('CreateShiftPage', () => {
  it('explains what is missing next to each field', async () => {
    const { user } = renderCreate();

    await screen.findByRole('heading', { level: 1, name: 'New shift' });
    await submit(user);

    await screen.findByText('Enter a title, like "Morning sorting".');
    expect(screen.getByLabelText('Title')).toHaveAccessibleDescription(
      'Enter a title, like "Morning sorting".',
    );
    expect(screen.getByLabelText('Date')).toHaveAccessibleDescription('Choose a date.');
    expect(screen.getByLabelText('Start time')).toHaveAccessibleDescription('Choose a start time.');
    expect(screen.getByLabelText('Volunteers needed')).toHaveAccessibleDescription(
      'Enter how many volunteers you need.',
    );
  });

  it('works in the organization’s time zone and explains overnight shifts', async () => {
    const { user } = renderCreate();

    const group = await screen.findByRole('group', { name: 'When' });
    expect(group).toHaveAccessibleDescription('Times are in Central Time (America/Chicago).');
    expect(screen.getByLabelText('End time')).toHaveAccessibleDescription(
      'If it’s at or before the start time, the shift ends the next day.',
    );

    await user.type(screen.getByLabelText('Date'), date);
    await user.type(screen.getByLabelText('Start time'), '22:00');
    await user.type(screen.getByLabelText('End time'), '06:00');

    expect(screen.getByLabelText('End time')).toHaveAccessibleDescription(
      /^Ends \w{3}, \w{3} \d{1,2} at 6:00 AM \(next day\)\.$/,
    );
  });

  it('creates the shift with times in the organization’s zone and opens it', async () => {
    let body: unknown;
    server.use(
      shiftHandlers.createOk(testShift.id, (sent) => (body = sent)),
      shiftHandlers.detail(testShift),
    );
    const { user, router } = renderCreate();

    await screen.findByRole('heading', { level: 1, name: 'New shift' });
    await fillShift(user);
    await fill(user, 'Location (optional)', 'Main warehouse');
    await submit(user);

    expect(await screen.findByText('Shift created.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Morning sorting' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/orgs/${testOrg.id}/shifts/${testShift.id}`);
    expect(body).toEqual({
      org_id: testOrg.id,
      title: 'Morning sorting',
      location: 'Main warehouse',
      description: null,
      start_time: zonedInstant({ date, time: '09:00' }, CHICAGO)?.toISOString(),
      end_time: zonedInstant({ date, time: '12:00' }, CHICAGO)?.toISOString(),
      capacity: 6,
    });
  });

  it('disables the button while saving', async () => {
    const gate = createGate();
    server.use(
      http.post(`${REST_URL}/shifts`, async () => {
        await gate.opened;
        return HttpResponse.json({ id: testShift.id });
      }),
      shiftHandlers.detail(testShift),
    );
    const { user } = renderCreate();

    await screen.findByRole('heading', { level: 1, name: 'New shift' });
    await fillShift(user);
    await submit(user);

    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled();
    gate.open();
    expect(await screen.findByText('Shift created.')).toBeInTheDocument();
  });

  it('explains a rule the database enforced', async () => {
    server.use(shiftHandlers.createFails('SHIFT_IN_PAST'));
    const { user } = renderCreate();

    await screen.findByRole('heading', { level: 1, name: 'New shift' });
    await fillShift(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A shift has to start in the future. Check the date and start time.',
    );
    expect(screen.getByRole('button', { name: 'Create shift' })).toBeEnabled();
  });

  it('cancels back to the shift list', async () => {
    renderCreate();

    expect(await screen.findByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `/orgs/${testOrg.id}/shifts`,
    );
  });

  it('keeps volunteers out', async () => {
    renderCreate('volunteer');

    expect(
      await screen.findByRole('heading', { name: "You don't have access to this page" }),
    ).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderCreate();

    await screen.findByRole('heading', { level: 1, name: 'New shift' });
    expect(await axe(container)).toHaveNoViolations();
  });
  describe('duplicating', () => {
    it('starts from a copy of the shift', async () => {
      server.use(shiftHandlers.detail(testShift));
      renderCreate('owner', `?from=${testShift.id}`);

      expect(
        await screen.findByText(
          'A copy of “Morning sorting”. Change the date and anything else that’s different.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toHaveValue('Morning sorting');
      expect(screen.getByLabelText('Date')).toHaveValue('2099-10-24');
      expect(screen.getByLabelText('Start time')).toHaveValue('09:00');
      expect(screen.getByLabelText('Location (optional)')).toHaveValue('Main warehouse');
      expect(screen.getByLabelText('Volunteers needed')).toHaveValue(6);
      expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
        'href',
        `/orgs/${testOrg.id}/shifts/${testShift.id}`,
      );
    });

    it('starts empty when the shift to copy can’t be found', async () => {
      server.use(shiftHandlers.detail(null));
      renderCreate('owner', `?from=${testShift.id}`);

      expect(
        await screen.findByText('We couldn’t find the shift to copy, so the form starts empty.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toHaveValue('');
    });
  });

  describe('overlap warning', () => {
    it('warns about a shift at the same location and time, but still saves', async () => {
      const requests: URLSearchParams[] = [];
      server.use(
        shiftHandlers.overlaps([summaryOf(afternoonShift)], (params) => requests.push(params)),
        shiftHandlers.createOk(testShift.id),
        shiftHandlers.detail(testShift),
      );
      const { user } = renderCreate();

      await screen.findByRole('heading', { level: 1, name: 'New shift' });
      await fillShift(user);
      await fill(user, 'Location (optional)', 'Main warehouse');

      expect(
        await screen.findByText('This overlaps another shift at Main warehouse:'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/^Afternoon packing, Sat, Oct 24, 2:00 PM – 5:00 PM$/),
      ).toBeInTheDocument();
      expect(requests.at(-1)?.get('location')).toBe('ilike.Main warehouse');

      await submit(user);
      expect(await screen.findByText('Shift created.')).toBeInTheDocument();
    });

    it('compares titles when there is no location', async () => {
      const requests: URLSearchParams[] = [];
      server.use(
        shiftHandlers.overlaps([summaryOf(testShift), summaryOf(afternoonShift)], (params) =>
          requests.push(params),
        ),
      );
      const { user } = renderCreate();

      await screen.findByRole('heading', { level: 1, name: 'New shift' });
      await fillShift(user);

      expect(
        await screen.findByText('This overlaps other shifts called “Morning sorting”:'),
      ).toBeInTheDocument();
      expect(requests.at(-1)?.get('title')).toBe('ilike.Morning sorting');
    });

    it('stays quiet until the times are complete', async () => {
      const requests: URLSearchParams[] = [];
      server.use(
        shiftHandlers.overlaps([summaryOf(afternoonShift)], (params) => requests.push(params)),
      );
      const { user } = renderCreate();

      await screen.findByRole('heading', { level: 1, name: 'New shift' });
      await fill(user, 'Title', 'Morning sorting');
      await user.type(screen.getByLabelText('Date'), date);

      // Longer than the check's pause, so a request would have gone out by now.
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(requests).toHaveLength(0);
      expect(screen.queryByText(/This overlaps/)).not.toBeInTheDocument();
    });
  });
});
