import { screen } from '@testing-library/react';
import { Link, Outlet } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { useFocusMainOnNavigate } from '@/hooks/useFocusMainOnNavigate';
import { renderRoutes } from '@/test/render';

function Layout() {
  const ref = useFocusMainOnNavigate<HTMLElement>();
  return (
    <>
      <nav>
        <Link to="/other">Other page</Link>
        <Link to="/?filter=open">Filter this page</Link>
        <Link to="/other#details">Other page, details section</Link>
      </nav>
      <main ref={ref} tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}

const routes = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, element: <h1>Home</h1> },
      { path: 'other', element: <h1>Other</h1> },
    ],
  },
];

describe('useFocusMainOnNavigate', () => {
  it('does not move focus on the initial page load', () => {
    renderRoutes(routes);

    expect(screen.getByRole('main')).not.toHaveFocus();
  });

  it('focuses the main region after navigating to another page', async () => {
    const { user } = renderRoutes(routes);

    await user.click(screen.getByRole('link', { name: 'Other page' }));

    expect(await screen.findByRole('heading', { name: 'Other' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('focuses without scrolling, leaving the scroll position to scroll restoration', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const { user } = renderRoutes(routes);

    await user.click(screen.getByRole('link', { name: 'Other page' }));

    await screen.findByRole('heading', { name: 'Other' });
    const mainFocusCall = focus.mock.contexts.indexOf(screen.getByRole('main'));
    expect(focus.mock.calls[mainFocusCall]).toEqual([{ preventScroll: true }]);
  });

  it('leaves focus to the page when the link targets a section', async () => {
    const { user } = renderRoutes(routes);
    const sectionLink = screen.getByRole('link', { name: 'Other page, details section' });

    await user.click(sectionLink);

    expect(await screen.findByRole('heading', { name: 'Other' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveFocus();
  });

  it('leaves focus alone when only search params change', async () => {
    const { user } = renderRoutes(routes);
    const filterLink = screen.getByRole('link', { name: 'Filter this page' });

    await user.click(filterLink);

    expect(filterLink).toHaveFocus();
  });
});
