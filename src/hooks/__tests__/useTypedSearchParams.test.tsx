import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { useTypedSearchParams } from '@/hooks/useTypedSearchParams';
import { renderWithProviders } from '@/test/render';

const schema = z.object({
  q: z.string().catch(''),
  view: z.enum(['list', 'week']).catch('list'),
});

function Probe() {
  const [values, setValues] = useTypedSearchParams(schema);
  return (
    <>
      <p>
        q={values.q} view={values.view}
      </p>
      <button
        type="button"
        onClick={() => {
          setValues({ q: 'jordan' });
        }}
      >
        Search
      </button>
      <button
        type="button"
        onClick={() => {
          setValues({ q: undefined, view: 'week' });
        }}
      >
        Week, clear search
      </button>
    </>
  );
}

describe('useTypedSearchParams', () => {
  it('reads typed values from the URL', () => {
    renderWithProviders(<Probe />, { route: '/members?q=alex&view=week' });

    expect(screen.getByText('q=alex view=week')).toBeInTheDocument();
  });

  it('falls back to defaults for missing or invalid values', () => {
    renderWithProviders(<Probe />, { route: '/members?view=month' });

    expect(screen.getByText('q= view=list')).toBeInTheDocument();
  });

  it('merges updates, drops empty values, and replaces the history entry', async () => {
    const { user, router } = renderWithProviders(<Probe />, { route: '/members?view=week' });

    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(router.state.location.search).toBe('?view=week&q=jordan');
    expect(router.state.historyAction).toBe('REPLACE');

    await user.click(screen.getByRole('button', { name: 'Week, clear search' }));
    expect(router.state.location.search).toBe('?view=week');
    expect(screen.getByText('q= view=week')).toBeInTheDocument();
  });
});
