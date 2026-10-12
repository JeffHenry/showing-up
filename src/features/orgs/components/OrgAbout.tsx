import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Organization } from '@/context/orgContext';

/** "example.org" for "https://www.example.org/about", to keep the link text short. */
function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** The organization's optional public details. Renders nothing when none are set. */
export function OrgAbout({ org }: { org: Organization }) {
  const { description, contact_email: contactEmail, website_url: websiteUrl } = org;
  if (!description && !contactEmail && !websiteUrl) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-medium">About</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        {description && <p className="whitespace-pre-line">{description}</p>}
        {(contactEmail ?? websiteUrl) && (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {contactEmail && (
              <>
                <dt className="text-muted-foreground">Contact</dt>
                <dd className="min-w-0 break-words">
                  <a href={`mailto:${contactEmail}`} className="underline underline-offset-4">
                    {contactEmail}
                  </a>
                </dd>
              </>
            )}
            {websiteUrl && (
              <>
                <dt className="text-muted-foreground">Website</dt>
                <dd className="min-w-0 break-words">
                  {/* Stored URLs are http(s) only (database CHECK), never javascript: */}
                  <a href={websiteUrl} rel="noreferrer" className="underline underline-offset-4">
                    {displayHost(websiteUrl)}
                  </a>
                </dd>
              </>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
