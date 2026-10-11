import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';

function StaleTime() {
  const staleTime = useQueryClient().getDefaultOptions().queries?.staleTime;
  return <p>staleTime {String(staleTime)}</p>;
}

describe('AppProviders', () => {
  it('provides a QueryClient configured with the app defaults', () => {
    render(
      <AppProviders>
        <StaleTime />
      </AppProviders>,
    );

    expect(screen.getByText('staleTime 30000')).toBeInTheDocument();
  });
});
