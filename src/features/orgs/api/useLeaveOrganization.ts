import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/context/useAuth';
import { leaveOrganization } from '@/features/orgs/api/orgsApi';

/**
 * Leaves an organization. The caller navigates away first and refreshes the organization list
 * afterwards, so the organization's own page never re-renders as "not found" on the way out.
 */
export function useLeaveOrganization() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: (orgId: string) => leaveOrganization({ orgId, userId: user?.id ?? '' }),
  });
}
