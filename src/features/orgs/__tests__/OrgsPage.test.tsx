import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { OrgsPage } from '@/features/orgs/components/OrgsPage';
import { testUser } from '@/test/fixtures/auth';
import { renderWithProviders } from '@/test/render';

describe('OrgsPage (placeholder)', () => {
  it('confirms who is signed in and says organizations are coming next', () => {
    renderWithProviders(<OrgsPage />, { auth: 'signedIn' });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Your organizations' }),
    ).toBeInTheDocument();
    expect(screen.getByText(`Signed in as ${String(testUser.email)}`)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Organizations are coming next' }),
    ).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderWithProviders(<OrgsPage />, { auth: 'signedIn' });

    expect(await axe(container)).toHaveNoViolations();
  });
});
