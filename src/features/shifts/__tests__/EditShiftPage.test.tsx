import { screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import type { ShiftDetail } from '@/features/shifts/types';
import { queryKeys } from '@/lib/queryKeys';
import { wallTimeAt, zonedInstant } from '@/lib/zonedTime';
import { testOrg } from '@/test/fixtures/orgs';
import { cancelledShift, testShift } from '@/test/fixtures/shifts';
import { orgHandlers } from '@/test/msw/orgs';
import { server } from '@/test/msw/server';
import { shiftHandlers, type ShiftUpdateRequest } from '@/test/msw/shifts';
import { renderRoutes } from '@/test/render';

/**
 * The shift being edited, a few days from now: the form only saves shifts that start in the
 * future and within a year, so the far-off fixture dates won't do here.
 */
const date = wallTimeAt(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), testOrg.timezone).date;
const startTime = zonedInstant({ date, time: '09:00' }, testOrg.timezone)?.toISOString() ?? '';
const endTime = zonedInstant({ date, time: '12:00' }, testOrg.timezone)?.toISOString() ?? '';
const upcomingShift: ShiftDetail = { ...testShift, start_time: startTime, end_time: endTime };

function renderEdit(shift: ShiftDetail = upcomingShift, role: 'owner' | 'volunteer' = 'owner') {
  server.use(orgHandlers.list([{ ...testOrg, role }]), shiftHandlers.detail(shift));
  return renderRoutes(routes, {
    route: `/orgs/${testOrg.id}/shifts/${shift.id}/edit`,
    auth: 'signedIn',
  });
}

type User = ReturnType<typeof renderEdit>['user'];

async function retitle(user: User, title: string) {
  const field = await screen.findByLabelText('Title');
  await user.clear(field);
  await user.type(field, title);
}

async function save(user: User) {
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
}

/** Someone else saved a change: the shift is now at version 2. */
const changedElsewhere: ShiftDetail = { ...upcomingShift, title: 'Sorting (moved)', version: 2 };

describe('EditShiftPage', () => {
  it('opens with the shift’s details, in the organization’s time zone', async () => {
    renderEdit();

    expect(await screen.findByLabelText('Title')).toHaveValue('Morning sorting');
    expect(screen.getByLabelText('Date')).toHaveValue(date);
    expect(screen.getByLabelText('Start time')).toHaveValue('09:00');
    expect(screen.getByLabelText('End time')).toHaveValue('12:00');
    expect(screen.getByLabelText('Location (optional)')).toHaveValue('Main warehouse');
    expect(screen.getByLabelText('Volunteers needed')).toHaveValue(6);
    expect(screen.getByLabelText('Details (optional)')).toHaveValue(testShift.description);
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `/orgs/${testOrg.id}/shifts/${testShift.id}`,
    );
  });

  it('never warns that the shift overlaps itself', async () => {
    const requests: URLSearchParams[] = [];
    server.use(shiftHandlers.overlaps([], (params) => requests.push(params)));
    renderEdit();

    await waitFor(() => {
      expect(requests.at(-1)?.get('id')).toBe(`neq.${testShift.id}`);
    });
  });

  it('saves against the loaded version and returns to the shift', async () => {
    let sent: ShiftUpdateRequest | undefined;
    server.use(shiftHandlers.updateOk((request) => (sent = request)));
    const { user, router } = renderEdit();

    await retitle(user, 'Morning sorting and packing');
    await save(user);

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/orgs/${testOrg.id}/shifts/${testShift.id}`);
    expect(sent?.id).toBe(testShift.id);
    expect(sent?.version).toBe('1');
    expect(sent?.body).toMatchObject({
      title: 'Morning sorting and packing',
      start_time: startTime,
      end_time: endTime,
      capacity: 6,
    });
  });

  it('tells you when someone else changed the shift, and reloads it on request', async () => {
    const { user } = renderEdit();

    await retitle(user, 'My edit');
    server.use(shiftHandlers.updateNoRows(), shiftHandlers.detail(changedElsewhere));
    await save(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Someone else changed this shift while you were editing.',
    );
    await user.click(screen.getByRole('button', { name: 'Load the latest version' }));

    expect(await screen.findByText('Loaded the latest version.')).toBeInTheDocument();
    const title = screen.getByLabelText('Title');
    expect(title).toHaveValue('Sorting (moved)');
    expect(title).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Saving now builds on the version just loaded.
    let sent: ShiftUpdateRequest | undefined;
    server.use(shiftHandlers.updateOk((request) => (sent = request)));
    await save(user);
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    expect(sent?.version).toBe('2');
  });

  it('still catches the conflict when the cached shift refreshes in the background', async () => {
    let sent: ShiftUpdateRequest | undefined;
    const { user, queryClient } = renderEdit();

    await retitle(user, 'My edit');
    // Someone else saves; this page's cached copy then refreshes (e.g. on window focus).
    server.use(shiftHandlers.detail(changedElsewhere));
    await queryClient.refetchQueries({ queryKey: queryKeys.shifts.detail(testShift.id) });
    server.use(shiftHandlers.updateOk((request) => (sent = request)));
    await save(user);

    // The edit still targets the version it started from, so the database can refuse it.
    await waitFor(() => {
      expect(sent?.version).toBe('1');
    });
  });

  it('says how many people are signed up, and explains a capacity below that', async () => {
    server.use(shiftHandlers.updateFails('CAPACITY_BELOW_SIGNUPS'));
    const { user } = renderEdit({ ...upcomingShift, confirmed_count: 3 });

    const capacity = await screen.findByLabelText('Volunteers needed');
    expect(capacity).toHaveAccessibleDescription('3 people are signed up, so keep at least 3.');
    await user.clear(capacity);
    await user.type(capacity, '2');
    await save(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'More people are already signed up than that.',
    );
  });

  it('gives no signup hint when no one has signed up', async () => {
    renderEdit({ ...upcomingShift, confirmed_count: 0 });

    expect(await screen.findByLabelText('Volunteers needed')).not.toHaveAccessibleDescription();
  });

  it('says so when the shift was deleted meanwhile', async () => {
    const { user } = renderEdit();

    await retitle(user, 'My edit');
    server.use(shiftHandlers.updateNoRows(), shiftHandlers.detail(null));
    await save(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This shift no longer exists. It may have been deleted.',
    );
    expect(
      screen.queryByRole('button', { name: 'Load the latest version' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['cancelled', cancelledShift, 'This shift was cancelled, so it can’t be changed.'],
    [
      'started',
      {
        ...testShift,
        start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      'This shift has started, so it can’t be changed.',
    ],
  ])('explains why a %s shift can’t be edited', async (_label, shift, message) => {
    renderEdit(shift);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the shift' })).toHaveAttribute(
      'href',
      `/orgs/${testOrg.id}/shifts/${shift.id}`,
    );
  });

  it('gives the not-found answer for a missing shift', async () => {
    renderEdit({ ...testShift, org_id: 'someone-else' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Shift not found' }),
    ).toBeInTheDocument();
  });

  it('explains a failed load', async () => {
    server.use(orgHandlers.list([testOrg]), shiftHandlers.detailFails());
    renderRoutes(routes, {
      route: `/orgs/${testOrg.id}/shifts/${testShift.id}/edit`,
      auth: 'signedIn',
    });

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load this shift");
  });

  it('keeps volunteers out', async () => {
    renderEdit(upcomingShift, 'volunteer');

    expect(
      await screen.findByRole('heading', { name: "You don't have access to this page" }),
    ).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderEdit();

    await screen.findByLabelText('Title');
    expect(await axe(container)).toHaveNoViolations();
  });
});
