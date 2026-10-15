import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import { LandingPage } from '@/app/routes/LandingPage';
import { NotFoundPage } from '@/app/routes/NotFoundPage';
import { PrivacyPage } from '@/app/routes/PrivacyPage';
import { PRIVACY_EMAIL, REPO_URL } from '@/lib/constants';
import { otherTestOrg, testOrg } from '@/test/fixtures/orgs';
import { orgHandlers } from '@/test/msw/orgs';
import { server } from '@/test/msw/server';
import { renderRoutes, renderWithProviders } from '@/test/render';

describe('LandingPage', () => {
  it('pitches the product and its three core capabilities', () => {
    renderWithProviders(<LandingPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Volunteer scheduling without the spreadsheets.',
    );
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Post shifts in minutes',
      'Claim a spot from any phone',
      'Track and approve hours',
    ]);
  });

  it('leads with sign-in and links to the source', () => {
    renderWithProviders(<LandingPage />);

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'View the source on GitHub' })).toHaveAttribute(
      'href',
      REPO_URL,
    );
    expect(screen.getByText(/signing up for shifts work today/i)).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderWithProviders(<LandingPage />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LandingPage: signed-in visitors', () => {
  it('opens their only organization', async () => {
    server.use(orgHandlers.list([testOrg]));
    renderRoutes(routes, { route: '/', auth: 'signedIn' });

    expect(
      await screen.findByRole('heading', { level: 1, name: testOrg.name }),
    ).toBeInTheDocument();
  });

  it('shows the organization list when they have several', async () => {
    server.use(orgHandlers.list([otherTestOrg, testOrg]));
    renderRoutes(routes, { route: '/', auth: 'signedIn' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your organizations' }),
    ).toBeInTheDocument();
  });

  it('takes them into the app from the header logo', async () => {
    server.use(orgHandlers.list([otherTestOrg, testOrg]));
    const { user } = renderRoutes(routes, { route: '/privacy', auth: 'signedIn' });

    await user.click(await screen.findByRole('link', { name: 'ShowingUp' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your organizations' }),
    ).toBeInTheDocument();
  });

  it('waits, rather than flashing the landing page, while a stored session is confirmed', () => {
    localStorage.setItem('sb-test-auth-token', '{}');
    renderWithProviders(<LandingPage />, { auth: 'loading' });

    expect(screen.getByRole('status')).toHaveTextContent('Opening ShowingUp…');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('shows the landing page right away when no session is stored', () => {
    renderWithProviders(<LandingPage />, { auth: 'loading' });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Volunteer scheduling without the spreadsheets.',
    );
  });
});

describe('NotFoundPage', () => {
  it('explains the problem and links home', () => {
    renderWithProviders(<NotFoundPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to home' })).toHaveAttribute('href', '/');
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderWithProviders(<NotFoundPage />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('PrivacyPage', () => {
  it('covers what is collected, who processes it, and how to request deletion', () => {
    renderWithProviders(<PrivacyPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'What we collect',
      "How it's used",
      'Who processes it',
      'Who can see your information',
      'Your choices',
    ]);
    expect(screen.getByRole('link', { name: PRIVACY_EMAIL })).toHaveAttribute(
      'href',
      `mailto:${PRIVACY_EMAIL}`,
    );
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderWithProviders(<PrivacyPage />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
