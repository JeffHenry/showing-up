import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import { otherTestOrg, testOrg } from '@/test/fixtures/orgs';
import { afternoonShift, cancelledShift, testShift } from '@/test/fixtures/shifts';
import { orgHandlers } from '@/test/msw/orgs';
import { server } from '@/test/msw/server';
import { shiftHandlers } from '@/test/msw/shifts';
import { renderRoutes } from '@/test/render';

function renderShift(shiftId = testShift.id) {
  server.use(orgHandlers.list([testOrg]));
  return renderRoutes(routes, {
    route: `/orgs/${testOrg.id}/shifts/${shiftId}`,
    auth: 'signedIn',
  });
}

function detail(term: string) {
  const termElement = screen.getByText(term, { selector: 'dt' });
  return termElement.nextElementSibling;
}

describe('ShiftDetailPage', () => {
  it('shows when and where the shift is, who it needs, and its details', async () => {
    server.use(shiftHandlers.detail(testShift));
    renderShift();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Morning sorting' }),
    ).toBeInTheDocument();
    expect(detail('When')).toHaveTextContent('Saturday, October 24, 2099, 9:00 AM – 12:00 PM CDT');
    expect(detail('Where')).toHaveTextContent('Main warehouse');
    expect(detail('Volunteers')).toHaveTextContent('6 volunteers needed');
    const details = screen.getByRole('region', { name: 'Details' });
    expect(details).toHaveTextContent('Wear closed-toe shoes. Ask for Sam at the front desk.', {
      normalizeWhitespace: true,
    });
    expect(screen.getByRole('link', { name: 'All shifts' })).toHaveAttribute(
      'href',
      `/orgs/${testOrg.id}/shifts`,
    );
    // The organization navigation keeps Shifts current on a shift's page.
    const nav = screen.getByRole('navigation', { name: 'Organization' });
    expect(within(nav).getByRole('link', { name: 'Shifts' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await waitFor(() => {
      expect(document.title).toBe('Morning sorting · Riverside Food Bank · ShowingUp');
    });
  });

  it('says when no location or details were given', async () => {
    server.use(shiftHandlers.detail(afternoonShift));
    renderShift(afternoonShift.id);

    await screen.findByRole('heading', { level: 1, name: 'Afternoon packing' });
    expect(detail('Where')).toHaveTextContent('No location given');
    expect(detail('Volunteers')).toHaveTextContent('1 volunteer needed');
    expect(screen.queryByRole('region', { name: 'Details' })).not.toBeInTheDocument();
  });

  it('makes a cancellation and its reason clear', async () => {
    server.use(shiftHandlers.detail(cancelledShift));
    renderShift(cancelledShift.id);

    await screen.findByRole('heading', { level: 1, name: 'Food drive' });
    expect(screen.getByText('This shift was cancelled.')).toBeInTheDocument();
    expect(screen.getByText('Rain forecast')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it.each([
    ['a shift that does not exist (or is hidden)', null],
    ['another organization’s shift', { ...testShift, org_id: otherTestOrg.id }],
  ])('gives the same not-found answer for %s', async (_label, shift) => {
    server.use(shiftHandlers.detail(shift));
    renderShift();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Shift not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All shifts' })).toHaveAttribute(
      'href',
      `/orgs/${testOrg.id}/shifts`,
    );
  });

  it('explains a failed load and retries', async () => {
    server.use(shiftHandlers.detailFails());
    const { user } = renderShift();

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load this shift");

    server.use(shiftHandlers.detail(testShift));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Morning sorting' }),
    ).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    server.use(shiftHandlers.detail(cancelledShift));
    const { container } = renderShift(cancelledShift.id);

    await screen.findByRole('heading', { level: 1, name: 'Food drive' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
