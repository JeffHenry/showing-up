import { Building2 } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/context/useAuth';
import { APP_NAME } from '@/lib/constants';

/** Signed-in landing page. Placeholder until the Organizations feature replaces it. */
export function OrgsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <title>{`Your organizations · ${APP_NAME}`}</title>
      <PageHeader
        title="Your organizations"
        description={user?.email ? `Signed in as ${user.email}` : undefined}
      />
      <EmptyState
        icon={Building2}
        title="Organizations are coming next"
        description="You're signed in. Creating and joining organizations is the next feature being built."
      />
    </div>
  );
}
