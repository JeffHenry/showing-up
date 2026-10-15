import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import { testOrg } from '@/test/fixtures/orgs';
import {
  afternoonShift,
  cancelledShift,
  manyShifts,
  overnightShift,
  summaryOf,
  testShift,
} from '@/test/fixtures/shifts';
import { createGate } from '@/test/gate';
import { orgHandlers } from '@/test/msw/orgs';
import { REST_URL, restError } from '@/test/msw/rest';
import { server } from '@/test/msw/server';
import { shiftHandlers, shiftRow } from '@/test/msw/shifts';
import { renderRoutes } from '@/test/render';

const volunteerOrg = { ...testOrg, role: 'volunteer' as const };
const fixtureShifts = [testShift, afternoonShift, cancelledShift, overnightShift].map(summaryOf);

function renderShifts({ asVolunteer = false, search = '' } = {}) {
  server.use(orgHandlers.list([asVolunteer ? volunteerOrg : testOrg]));
  return renderRoutes(routes, {
    route: `/orgs/${testOrg.id}/shifts${search}`,
    auth: 'signedIn',
  });
}

/** The list item for a shift, found by its title link. */
function shiftItem(title: string) {
  const item = screen
    .getAllByRole('listitem')
    .find((candidate) => within(candidate).queryByRole('link', { name: title }));
  if (!item) throw new Error(`No list item for ${title}`);
  return item;
}

describe('ShiftsPage', () => {
  it('lists upcoming shifts by day, in the organization’s time zone', async () => {
    server.use(shiftHandlers.list(fixtureShifts));
    renderShifts();

    expect(await screen.findByRole('heading', { level: 1, name: 'Shifts' })).toBeInTheDocument();
    expect(screen.getByText('Times are in Central Time.')).toBeInTheDocument();
    await screen.findByRole('link', { name: 'Morning sorting' });

    const saturday = screen.getByRole('region', { name: 'Saturday, October 24, 2099' });
    expect(
      within(saturday)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Morning sorting', 'Afternoon packing']);
    expect(within(saturday).getByRole('link', { name: 'Morning sorting' })).toHaveAttribute(
      'href',
      `/orgs/${testOrg.id}/shifts/${testShift.id}`,
    );
    expect(within(saturday).getByText('9:00 AM – 12:00 PM')).toBeInTheDocument();
    expect(within(saturday).getByText('Main warehouse')).toBeInTheDocument();
    expect(shiftItem('Morning sorting')).toHaveTextContent('2 of 6 filled');
    expect(shiftItem('Afternoon packing')).toHaveTextContent('Full');

    const sunday = screen.getByRole('region', { name: 'Sunday, October 25, 2099' });
    expect(within(sunday).getByRole('link', { name: 'Food drive' })).toBeInTheDocument();
    expect(shiftItem('Food drive')).toHaveTextContent('Cancelled');
    expect(within(sunday).getByText('10:00 PM – 6:00 AM (next day)')).toBeInTheDocument();
    // Shifts the signed-in person claimed are marked, with text as well as an icon.
    expect(shiftItem('Overnight shelter')).toHaveTextContent('You’re signed up');
    expect(shiftItem('Morning sorting')).not.toHaveTextContent('You’re signed up');

    await waitFor(() => {
      expect(document.title).toBe('Shifts · Riverside Food Bank · ShowingUp');
    });
  });

  it('marks a shift that is under way as in progress', async () => {
    const now = Date.now();
    server.use(
      shiftHandlers.list([
        {
          ...summaryOf(testShift),
          start_time: new Date(now - 60 * 60 * 1000).toISOString(),
          end_time: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        },
      ]),
    );
    renderShifts();

    await screen.findByRole('link', { name: 'Morning sorting' });
    expect(shiftItem('Morning sorting')).toHaveTextContent('In progress');
  });

  it('offers coordinators and owners a New shift button', async () => {
    server.use(shiftHandlers.list(fixtureShifts));
    renderShifts();

    expect(await screen.findByRole('link', { name: 'New shift' })).toHaveAttribute(
      'href',
      `/orgs/${testOrg.id}/shifts/new`,
    );
  });

  it('shows volunteers the shifts, but not the New shift button', async () => {
    server.use(shiftHandlers.list(fixtureShifts));
    renderShifts({ asVolunteer: true });

    await screen.findByRole('link', { name: 'Morning sorting' });
    expect(screen.queryByRole('link', { name: 'New shift' })).not.toBeInTheDocument();
  });

  it('invites coordinators to create the first shift', async () => {
    server.use(shiftHandlers.list([]));
    renderShifts();

    expect(
      await screen.findByRole('heading', { level: 2, name: 'No upcoming shifts' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'New shift' })).toHaveLength(2);
  });

  it('tells volunteers when nothing is posted yet', async () => {
    server.use(shiftHandlers.list([]));
    renderShifts({ asVolunteer: true });

    expect(await screen.findByText(/haven’t posted any shifts yet/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New shift' })).not.toBeInTheDocument();
  });

  it('switches to past shifts through the URL', async () => {
    const requests: URLSearchParams[] = [];
    server.use(shiftHandlers.list([], [], (params) => requests.push(params)));
    const { user, router } = renderShifts();

    await screen.findByRole('heading', { level: 2, name: 'No upcoming shifts' });
    const nav = screen.getByRole('navigation', { name: 'Shift dates' });
    expect(within(nav).getByRole('link', { name: 'Upcoming' })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await user.click(within(nav).getByRole('link', { name: 'Past' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'No past shifts yet' }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toBe('?when=past');
    expect(within(nav).getByRole('link', { name: 'Past' })).toHaveAttribute('aria-current', 'true');
    expect(requests.at(-1)?.get('order')).toBe('start_time.desc,id.desc');
  });

  it('re-checks spot counts each time the page opens, without waiting for the cache to age', async () => {
    server.use(shiftHandlers.list([summaryOf(testShift)]));
    const { user } = renderShifts();

    const nav = await screen.findByRole('navigation', { name: 'Organization' });
    await screen.findByRole('link', { name: 'Morning sorting' });
    expect(shiftItem('Morning sorting')).toHaveTextContent('2 of 6 filled');

    // Someone else signs up while this person looks at another page.
    server.use(shiftHandlers.list([{ ...summaryOf(testShift), confirmed_count: 3 }]));
    await user.click(within(nav).getByRole('link', { name: 'Overview' }));
    await screen.findByRole('heading', { level: 1, name: 'Riverside Food Bank' });
    await user.click(within(nav).getByRole('link', { name: 'Shifts' }));

    await waitFor(() => {
      expect(shiftItem('Morning sorting')).toHaveTextContent('3 of 6 filled');
    });
  });

  it('opens on past shifts from a shared link', async () => {
    server.use(shiftHandlers.list([summaryOf(testShift)]));
    renderShifts({ search: '?when=past' });

    expect(await screen.findByRole('link', { name: 'Morning sorting' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Past' })).toHaveAttribute('aria-current', 'true');
  });

  it('loads more shifts on request and moves focus to the first new one', async () => {
    server.use(shiftHandlers.list(manyShifts(21), manyShifts(2, 21)));
    const { user } = renderShifts();

    await screen.findByRole('link', { name: 'Shift 20' });
    expect(screen.queryByRole('link', { name: 'Shift 21' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more shifts' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Shift 21' })).toHaveFocus();
    });
    expect(screen.getByRole('link', { name: 'Shift 22' })).toBeInTheDocument();
    expect(screen.getByText('Loaded 2 more shifts.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more shifts' })).not.toBeInTheDocument();
  });

  it('shows that more shifts are loading, and explains a failure', async () => {
    const gate = createGate();
    server.use(
      http.get(`${REST_URL}/shifts`, async ({ request }) => {
        if (!new URL(request.url).searchParams.has('or')) {
          return HttpResponse.json(manyShifts(21).map(shiftRow));
        }
        await gate.opened;
        return restError(500, 'XX000', 'internal error');
      }),
    );
    const { user } = renderShifts();

    await user.click(await screen.findByRole('button', { name: 'Load more shifts' }));

    expect(await screen.findByRole('button', { name: 'Loading…' })).toBeDisabled();
    gate.open();
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load more shifts");
    expect(screen.getByRole('button', { name: 'Load more shifts' })).toBeEnabled();
  });

  it('shows a loading state, then explains a failed load and retries', async () => {
    const gate = createGate();
    server.use(
      http.get(`${REST_URL}/shifts`, async () => {
        await gate.opened;
        return restError(500, 'XX000', 'internal error');
      }),
    );
    const { user } = renderShifts();

    expect(await screen.findByText('Loading shifts…')).toBeInTheDocument();
    gate.open();
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load shifts");

    server.use(shiftHandlers.list(fixtureShifts));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: 'Morning sorting' })).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    server.use(shiftHandlers.list(fixtureShifts));
    const { container } = renderShifts();

    await screen.findByRole('link', { name: 'Morning sorting' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
