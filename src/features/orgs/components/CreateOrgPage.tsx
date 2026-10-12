import { PageHeader } from '@/components/common/PageHeader';
import { CreateOrgForm } from '@/features/orgs/components/CreateOrgForm';
import { APP_NAME } from '@/lib/constants';

export function CreateOrgPage() {
  return (
    <div className="max-w-xl space-y-6">
      <title>{`New organization · ${APP_NAME}`}</title>
      <PageHeader
        title="New organization"
        description="You'll be its owner, and you can create up to 2."
      />
      <CreateOrgForm />
    </div>
  );
}
