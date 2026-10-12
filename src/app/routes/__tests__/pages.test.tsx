import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { LandingPage } from '@/app/routes/LandingPage';
import { NotFoundPage } from '@/app/routes/NotFoundPage';
import { PrivacyPage } from '@/app/routes/PrivacyPage';
import { PRIVACY_EMAIL, REPO_URL } from '@/lib/constants';
import { renderWithProviders } from '@/test/render';

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
    expect(screen.getByText(/organizations and scheduling are next/i)).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderWithProviders(<LandingPage />);

    expect(await axe(container)).toHaveNoViolations();
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
