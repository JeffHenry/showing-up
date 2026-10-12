import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateOrganization } from '@/features/orgs/api/useCreateOrganization';
import {
  createOrgSchema,
  DESCRIPTION_MAX_LENGTH,
  type CreateOrgFormOutput,
  type CreateOrgFormValues,
} from '@/features/orgs/schemas';
import { toAppError } from '@/lib/errors';
import { slugify } from '@/lib/slug';
import { browserTimeZone, timeZoneLabel, timeZoneOptions } from '@/lib/timezones';

const TIME_ZONES = timeZoneOptions();

/** Blank optional fields are left out, so the database stores them as empty. */
function toInput({ description, contactEmail, websiteUrl, ...required }: CreateOrgFormOutput) {
  return {
    ...required,
    description: description || undefined,
    contactEmail: contactEmail || undefined,
    websiteUrl: websiteUrl || undefined,
  };
}

export function CreateOrgForm() {
  const navigate = useNavigate();
  const createOrg = useCreateOrganization();
  // The short name follows the name until the user types their own.
  const [slugEdited, setSlugEdited] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitted },
  } = useForm<CreateOrgFormValues, unknown, CreateOrgFormOutput>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: '',
      slug: '',
      timezone: browserTimeZone(),
      description: '',
      contactEmail: '',
      websiteUrl: '',
    },
  });
  const description = useWatch({ control, name: 'description' });

  const onSubmit = handleSubmit((values) => {
    createOrg.mutate(toInput(values), {
      onSuccess: (org) => {
        void navigate(`/orgs/${org.id}`);
      },
      onError: (error) => {
        const appError = toAppError(error);
        if (appError.code === 'SLUG_TAKEN') {
          setError('slug', { message: appError.message }, { shouldFocus: true });
        }
      },
    });
  });

  const requestError = createOrg.error ? toAppError(createOrg.error) : null;

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <FormField id="org-name" label="Name" error={errors.name?.message}>
        {(field) => (
          <Input
            {...field}
            autoComplete="organization"
            {...register('name', {
              onChange: (event: ChangeEvent<HTMLInputElement>) => {
                if (slugEdited) return;
                setValue('slug', slugify(event.target.value), { shouldValidate: isSubmitted });
              },
            })}
          />
        )}
      </FormField>
      <FormField
        id="org-slug"
        label="Short name"
        hint="A unique handle: lowercase letters, numbers, and hyphens."
        error={errors.slug?.message}
      >
        {(field) => (
          <Input
            {...field}
            autoComplete="off"
            spellCheck={false}
            {...register('slug', {
              onChange: (event: ChangeEvent<HTMLInputElement>) => {
                setSlugEdited(event.target.value !== '');
              },
            })}
          />
        )}
      </FormField>
      <FormField
        id="org-timezone"
        label="Time zone"
        hint="Shift times are shown in this time zone."
        error={errors.timezone?.message}
      >
        {(field) => (
          <NativeSelect className="w-full" {...field} {...register('timezone')}>
            {TIME_ZONES.map((zone) => (
              <NativeSelectOption key={zone} value={zone}>
                {timeZoneLabel(zone)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <fieldset className="space-y-6 border-t pt-6">
        <legend className="float-left mb-1 w-full font-medium">About (optional)</legend>
        <p className="clear-left text-sm text-muted-foreground">
          Members of your organization can see these details.
        </p>
        <FormField
          id="org-description"
          label="Description"
          hint={`${String(description.length)} of ${String(DESCRIPTION_MAX_LENGTH)} characters`}
          error={errors.description?.message}
        >
          {(field) => <Textarea {...field} rows={3} {...register('description')} />}
        </FormField>
        <FormField
          id="org-contact-email"
          label="Contact email"
          error={errors.contactEmail?.message}
        >
          {(field) => (
            <Input {...field} type="email" autoComplete="email" {...register('contactEmail')} />
          )}
        </FormField>
        <FormField id="org-website" label="Website" error={errors.websiteUrl?.message}>
          {(field) => (
            <Input
              {...field}
              type="url"
              autoComplete="url"
              placeholder="https://"
              {...register('websiteUrl')}
            />
          )}
        </FormField>
      </fieldset>

      {requestError && requestError.code !== 'SLUG_TAKEN' && (
        <p role="alert" className="text-sm text-destructive">
          {requestError.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={createOrg.isPending || createOrg.isSuccess}>
          {createOrg.isPending ? 'Creating…' : 'Create organization'}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/orgs">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
