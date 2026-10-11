import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { renderWithProviders } from '@/test/render';

describe('App', () => {
  it('shows the app name as the main heading', () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'ShowingUp' })).toBeInTheDocument();
  });

  it('lets keyboard users reach the primary action', async () => {
    const { user } = renderWithProviders(<App />);

    await user.tab();

    expect(screen.getByRole('button', { name: 'Get started' })).toHaveFocus();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderWithProviders(<App />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
