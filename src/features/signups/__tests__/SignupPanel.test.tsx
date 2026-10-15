import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import type { ShiftDetail } from '@/features/shifts/types';
import { testOrg } from '@/test/fixtures/orgs';
import { afternoonShift, cancelledShift, overnightShift, testShift } from '@/test/fixtures/shifts';
import { createGate } from '@/test/gate';
import { orgHandlers } from '@/test/msw/orgs';
import { server } from '@/test/msw/server';
import { shiftHandlers } from '@/test/msw/shifts';
import { signupHandlers } from '@/test/msw/signups';
import { renderRoutes } from '@/test/render';

// Signing up and dropping out on a shift's page, through the real route tree.
function renderShift(shift: ShiftDetail, role: 'owner' | 'volunteer' = 'volunteer') {
  server.use(orgHandlers.list([{ ...testOrg, role }]), shiftHandlers.detail(shift));
  return renderRoutes(routes, {
    route: `/orgs/${testOrg.id}/shifts/${shift.id}`,
    auth: 'signedIn',
  });
}

async function spots() {
  return screen.findByRole('region', { name: 'Volunteer spots' });
}

/** A shift that started an hour ago. */
function started(shift: ShiftDetail): ShiftDetail {
  const now = Date.now();
  return {
    ...shift,
    start_time: new Date(now - 60 * 60 * 1000).toISOString(),
    end_time: new Date(now + 60 * 60 * 1000).toISOString(),
  };
}

describe('signing up', () => {
  it('shows the signup at once, before the server answers, and confirms it', async () => {
    const gate = createGate();
    let body: unknown;
    server.use(
      signupHandlers.claimOk(
        (sent) => (body = sent),
        () => gate.opened,
      ),
    );
    const { user } = renderShift(testShift);

    const panel = await spots();
    expect(panel).toHaveTextContent('2 of 6 spots filled · 4 left');
    const button = within(panel).getByRole('button', { name: 'Sign up' });
    await user.click(button);

    // Optimistic: the page changes while the request is still out.
    expect(await within(panel).findByText('You’re signed up.')).toBeInTheDocument();
    expect(panel).toHaveTextContent('3 of 6 spots filled · 3 left');
    expect(within(panel).getByRole('button', { name: 'Drop out' })).toBeDisabled();

    server.use(shiftHandlers.detail({ ...testShift, confirmed_count: 3, signed_up: true }));
    gate.open();

    expect(
      await within(panel).findByText('You’re signed up for Morning sorting.'),
    ).toBeInTheDocument();
    expect(body).toEqual({ p_shift_id: testShift.id });
    const dropOut = within(panel).getByRole('button', { name: 'Drop out' });
    expect(dropOut).toBeEnabled();
    // The same button changed its label, so focus stayed on it.
    expect(dropOut).toHaveFocus();
  });

  it('rolls back and explains when the last spot went to someone else', async () => {
    const gate = createGate();
    server.use(signupHandlers.claimFails('SHIFT_FULL', 'P0001', () => gate.opened));
    const { user } = renderShift(testShift);

    const panel = await spots();
    await user.click(within(panel).getByRole('button', { name: 'Sign up' }));
    expect(await within(panel).findByText('You’re signed up.')).toBeInTheDocument();

    // Meanwhile others filled the shift.
    server.use(shiftHandlers.detail({ ...testShift, confirmed_count: 6 }));
    gate.open();

    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'This shift is full. Someone took the last spot just before you.',
    );
    expect(within(panel).queryByText('You’re signed up.')).not.toBeInTheDocument();
    expect(await within(panel).findByText('This shift is full.')).toBeInTheDocument();
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument();
    // The button went away while focused, so focus moves to the section's heading.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Volunteer spots' })).toHaveFocus();
    });
  });

  it('explains a clash with another shift and lets you try again', async () => {
    server.use(signupHandlers.claimFails('SCHEDULE_CONFLICT'));
    const { user } = renderShift(testShift);

    const panel = await spots();
    await user.click(within(panel).getByRole('button', { name: 'Sign up' }));

    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      "You're already signed up for another shift at that time.",
    );
    expect(within(panel).getByRole('button', { name: 'Sign up' })).toBeEnabled();
    expect(panel).toHaveTextContent('2 of 6 spots filled · 4 left');
  });

  it('is offered to coordinators and owners too', async () => {
    renderShift(testShift, 'owner');

    expect(within(await spots()).getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
  });
});

describe('dropping out', () => {
  it('drops out after confirming, freeing the spot at once', async () => {
    let body: unknown;
    server.use(signupHandlers.cancelOk((sent) => (body = sent)));
    const { user } = renderShift(overnightShift);

    const panel = await spots();
    expect(within(panel).getByText('You’re signed up.')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Drop out' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Drop out of “Overnight shelter”?',
    });
    server.use(shiftHandlers.detail({ ...overnightShift, confirmed_count: 0, signed_up: false }));
    await user.click(within(dialog).getByRole('button', { name: 'Drop out' }));

    expect(
      await within(panel).findByText('You dropped out of Overnight shelter.'),
    ).toBeInTheDocument();
    expect(panel).toHaveTextContent('0 of 2 spots filled · 2 left');
    expect(body).toEqual({ p_shift_id: overnightShift.id });
    await waitFor(() => {
      expect(within(panel).getByRole('button', { name: 'Sign up' })).toHaveFocus();
    });
  });

  it('stays signed up when the dialog is dismissed', async () => {
    const { user } = renderShift(overnightShift);

    const panel = await spots();
    await user.click(within(panel).getByRole('button', { name: 'Drop out' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Stay signed up' }));

    await waitFor(() => {
      expect(within(panel).getByRole('button', { name: 'Drop out' })).toHaveFocus();
    });
    expect(within(panel).getByText('You’re signed up.')).toBeInTheDocument();
  });

  it('rolls back and explains a refusal', async () => {
    server.use(signupHandlers.cancelFails('SHIFT_STARTED'));
    const { user } = renderShift(overnightShift);

    const panel = await spots();
    await user.click(within(panel).getByRole('button', { name: 'Drop out' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Drop out' }));

    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      "This shift has already started, so it can't be changed.",
    );
    expect(within(panel).getByText('You’re signed up.')).toBeInTheDocument();
    expect(panel).toHaveTextContent('1 of 2 spots filled · 1 left');
  });
});

describe('when signing up is closed', () => {
  it.each([
    ['full', afternoonShift, 'This shift is full.'],
    ['started', started(testShift), 'This shift has started, so sign-ups are closed.'],
    [
      'cancelled (and you were signed up)',
      { ...cancelledShift, signed_up: true, confirmed_count: 1 },
      'You don’t need to come: this shift was cancelled.',
    ],
  ])('says so for a %s shift, without a button', async (_label, shift, message) => {
    renderShift(shift);

    const panel = await spots();
    expect(within(panel).getByText(message)).toBeInTheDocument();
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps a started shift’s signup, without a way to drop out', async () => {
    renderShift(started(overnightShift));

    const panel = await spots();
    expect(within(panel).getByText('You’re signed up.')).toBeInTheDocument();
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument();
  });
});

it('has no detectable accessibility violations', async () => {
  const { container } = renderShift(overnightShift);

  await spots();
  expect(await axe(container)).toHaveNoViolations();
});
