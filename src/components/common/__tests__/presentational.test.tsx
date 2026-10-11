import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';

describe('PageHeader', () => {
  it('renders the page title as the h1 with description and actions', () => {
    render(
      <PageHeader
        title="Shifts"
        description="Upcoming shifts for Food Bank"
        actions={<Button type="button">New shift</Button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Shifts' })).toBeInTheDocument();
    expect(screen.getByText('Upcoming shifts for Food Bank')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New shift' })).toBeInTheDocument();
  });

  it('renders just the title when nothing else is given', () => {
    render(<PageHeader title="Members" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<PageHeader title="Shifts" description="Upcoming shifts" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('EmptyState', () => {
  it('explains the empty view and offers the next step', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No shifts yet"
        description="Create a shift so volunteers can sign up."
        action={<Button type="button">Create a shift</Button>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'No shifts yet' })).toBeInTheDocument();
    expect(screen.getByText('Create a shift so volunteers can sign up.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a shift' })).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<EmptyState icon={Inbox} title="No shifts yet" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LoadingScreen', () => {
  it('announces loading to assistive technology', () => {
    render(<LoadingScreen />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading ShowingUp…');
  });
});
