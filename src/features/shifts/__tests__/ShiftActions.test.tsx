import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import type { ShiftDetail } from '@/features/shifts/types';
import { testOrg } from '@/test/fixtures/orgs';
import { afternoonShift, cancelledShift, summaryOf, testShift } from '@/test/fixtures/shifts';
import { createGate } from '@/test/gate';
import { orgHandlers } from '@/test/msw/orgs';
import { REST_URL, restError } from '@/test/msw/rest';
import { server } from '@/test/msw/server';
import { shiftHandlers } from '@/test/msw/shifts';
import { renderRoutes } from '@/test/render';

// The actions on a shift's own page, through the real route tree.
function renderShift(
  shift: ShiftDetail,
  { role = 'owner', state }: { role?: 'owner' | 'volunteer'; state?: unknown } = {},
) {
  server.use(orgHandlers.list([{ ...testOrg, role }]), shiftHandlers.detail(shift));
  return renderRoutes(routes, {
    route: { pathname: `/orgs/${testOrg.id}/shifts/${shift.id}`, state },
    auth: 'signedIn',
  });
}

/** The names of the links and buttons offered under "Manage shift". */
async function actionNames() {
  const actions = await screen.findByRole('region', { name: 'Manage shift' });
  return [
    ...within(actions).queryAllByRole('link'),
    ...within(actions).queryAllByRole('button'),
  ].map((element) => element.textContent);
}

/** A shift that started an hour ago. */
function startedShift(): ShiftDetail {
  const now = Date.now();
  return {
    ...testShift,
    start_time: new Date(now - 60 * 60 * 1000).toISOString(),
    end_time: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
  };
}

describe('managing a shift', () => {
  it('offers coordinators every action on an upcoming shift', async () => {
    renderShift(testShift);

    expect(await actionNames()).toEqual(['Edit', 'Duplicate', 'Cancel shift', 'Delete']);
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/orgs/${testOrg.id}/shifts/${testShift.id}/edit`,
    );
    expect(screen.getByRole('link', { name: 'Duplicate' })).toHaveAttribute(
      'href',
      `/orgs/${testOrg.id}/shifts/new?from=${testShift.id}`,
    );
  });

  it('offers only duplicating and deleting a cancelled shift', async () => {
    renderShift(cancelledShift);

    expect(await actionNames()).toEqual(['Duplicate', 'Delete']);
  });

  it('locks a shift once it starts, except for duplicating', async () => {
    renderShift(startedShift());

    expect(await actionNames()).toEqual(['Duplicate']);
    expect(
      screen.getByText(
        'This shift has started, so it can’t be changed. You can still duplicate it.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('offers volunteers no actions', async () => {
    renderShift(testShift, { role: 'volunteer' });

    await screen.findByRole('heading', { level: 1, name: 'Morning sorting' });
    expect(screen.queryByRole('region', { name: 'Manage shift' })).not.toBeInTheDocument();
  });

  it('confirms a save the form made on the way here', async () => {
    renderShift(testShift, { state: { shiftNotice: 'saved' } });

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
  });
});

describe('cancelling a shift', () => {
  it('cancels with a reason, then shows the shift as cancelled', async () => {
    let body: unknown;
    server.use(shiftHandlers.cancelOk((sent) => (body = sent)));
    const { user } = renderShift(testShift);

    await user.click(await screen.findByRole('button', { name: 'Cancel shift' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Cancel “Morning sorting”?' });
    await user.type(within(dialog).getByLabelText('Reason (optional)'), 'Rain forecast');
    // What the page reloads once the cancellation succeeds.
    server.use(
      shiftHandlers.detail({
        ...testShift,
        cancelled_at: '2099-10-01T00:00:00Z',
        cancel_reason: 'Rain forecast',
        version: 2,
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Cancel shift' }));

    expect(await screen.findByText('This shift was cancelled.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(body).toEqual({ p_shift_id: testShift.id, p_reason: 'Rain forecast' });
    expect(screen.getByText('Shift cancelled.')).toBeInTheDocument();
    // The Cancel button went away with the change, so focus moves to the section's heading.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Manage shift' })).toHaveFocus();
    });
    expect(await actionNames()).toEqual(['Duplicate', 'Delete']);
  });

  it('keeps the shift when the dialog is dismissed, returning focus to the button', async () => {
    const { user } = renderShift(testShift);

    const cancelButton = await screen.findByRole('button', { name: 'Cancel shift' });
    await user.click(cancelButton);
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Keep shift' }));

    await waitFor(() => {
      expect(cancelButton).toHaveFocus();
    });
  });

  it('shows progress, then a refusal inside the dialog', async () => {
    const gate = createGate();
    server.use(
      http.post(`${REST_URL}/rpc/cancel_shift`, async () => {
        await gate.opened;
        return restError(400, 'P0001', 'SHIFT_STARTED');
      }),
    );
    const { user } = renderShift(testShift);

    await user.click(await screen.findByRole('button', { name: 'Cancel shift' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel shift' }));

    expect(await within(dialog).findByRole('button', { name: 'Cancelling…' })).toBeDisabled();
    gate.open();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "This shift has already started, so it can't be changed.",
    );
  });
});

describe('deleting a shift', () => {
  it('deletes it and returns to the list, saying what was deleted', async () => {
    let deletedId: string | null = null;
    server.use(
      shiftHandlers.deleteOk((id) => (deletedId = id)),
      shiftHandlers.list([summaryOf(afternoonShift)]),
    );
    const { user, router } = renderShift(testShift);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete “Morning sorting”?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete shift' }));

    expect(await screen.findByText('Deleted “Morning sorting”.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/orgs/${testOrg.id}/shifts`);
    expect(deletedId).toBe(testShift.id);
    expect(await screen.findByRole('link', { name: 'Afternoon packing' })).toBeInTheDocument();
  });

  it('explains a refusal inside the dialog', async () => {
    server.use(shiftHandlers.deleteNoRows());
    const { user } = renderShift(testShift);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete shift' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "You don't have permission to do that.",
    );
  });
});

it('has no detectable accessibility violations with the cancel dialog open', async () => {
  const { user, baseElement } = renderShift(testShift);

  await user.click(await screen.findByRole('button', { name: 'Cancel shift' }));
  await screen.findByRole('alertdialog');
  expect(await axe(baseElement)).toHaveNoViolations();
});
