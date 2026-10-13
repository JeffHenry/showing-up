import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { RecentlyAcceptedInvites } from '@/features/invites/components/RecentlyAcceptedInvites';
import { testAcceptedInvite } from '@/test/fixtures/invites';
import { testOrg } from '@/test/fixtures/orgs';
import { inviteHandlers } from '@/test/msw/invites';
import { REST_URL } from '@/test/msw/rest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

function renderAccepted() {
  return renderWithProviders(
    <RecentlyAcceptedInvites orgId={testOrg.id} timeZone={testOrg.timezone} />,
    { auth: 'signedIn' },
  );
}

describe('RecentlyAcceptedInvites', () => {
  it('shows who joined, as what, when, and who invited them', async () => {
    server.use(inviteHandlers.accepted([testAcceptedInvite]));
    renderAccepted();

    const item = await screen.findByRole('listitem');
    expect(item).toHaveTextContent(
      'Jordan Lee joined as a volunteerOct 12, 2026 · Invited by Taylor Tester',
    );
  });

  it('copes with people who have since left', async () => {
    server.use(
      inviteHandlers.accepted([{ ...testAcceptedInvite, usedByName: null, createdByName: null }]),
    );
    renderAccepted();

    const item = await screen.findByRole('listitem');
    expect(item).toHaveTextContent('A former member joined as a volunteer');
    expect(item).not.toHaveTextContent('Invited by');
  });

  it('asks for used invites from the last 30 days, newest first', async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`${REST_URL}/invites`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json([]);
      }),
    );
    renderAccepted();

    expect(await screen.findByText('No invites accepted in the last 30 days.')).toBeInTheDocument();
    const params = requests[0]?.searchParams;
    expect(params?.getAll('used_at')).toEqual([
      'not.is.null',
      expect.stringMatching(/^gte\./) as string,
    ]);
    expect(params?.get('order')).toBe('used_at.desc');
    expect(params?.get('select')).toContain('used_by:profiles!invites_used_by_fkey(full_name)');
  });

  it('explains a failed load and retries', async () => {
    server.use(inviteHandlers.acceptedFails());
    const { user } = renderAccepted();

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load accepted invites");

    server.use(inviteHandlers.accepted([testAcceptedInvite]));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('listitem')).toBeInTheDocument();
  });
});
