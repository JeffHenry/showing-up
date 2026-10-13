import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/context/useAuth';
import { useMyProfile } from '@/features/account/api/useMyProfile';
import { NameForm } from '@/features/account/components/NameForm';
import { APP_NAME } from '@/lib/constants';

/** The signed-in person's own details. Only reached through `RequireName`, so a name exists. */
export function AccountPage() {
  const { user } = useAuth();
  const { data: profile } = useMyProfile();

  return (
    <div className="max-w-xl space-y-8">
      <title>{`Account · ${APP_NAME}`}</title>
      <PageHeader title="Account" />
      <section aria-labelledby="name-heading" className="space-y-4">
        <h2 id="name-heading" className="text-lg font-medium">
          Name
        </h2>
        <NameForm
          defaultName={profile?.full_name ?? ''}
          submitLabel="Save name"
          savedMessage="Name saved."
        />
      </section>
      <section aria-labelledby="email-heading" className="space-y-2">
        <h2 id="email-heading" className="text-lg font-medium">
          Email
        </h2>
        <p>{user?.email}</p>
        <p className="text-sm text-muted-foreground">
          You sign in with this address. Coordinators and owners of your organizations can see it.
        </p>
      </section>
    </div>
  );
}
