import { useQuery } from '@tanstack/react-query';
import {
  fetchAcceptedInvites,
  fetchInvitePreview,
  fetchPendingInvites,
} from '@/features/invites/api/invitesApi';
import { queryKeys } from '@/lib/queryKeys';

export function usePendingInvites(orgId: string) {
  return useQuery({
    queryKey: queryKeys.invites.pending(orgId),
    queryFn: () => fetchPendingInvites(orgId),
  });
}

export function useAcceptedInvites(orgId: string) {
  return useQuery({
    queryKey: queryKeys.invites.accepted(orgId),
    queryFn: () => fetchAcceptedInvites(orgId),
  });
}

export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: queryKeys.invites.preview(token),
    queryFn: () => fetchInvitePreview(token),
    // "Not found" or "expired" won't change on a retry; the page offers "Try again" for the rest.
    retry: false,
  });
}
