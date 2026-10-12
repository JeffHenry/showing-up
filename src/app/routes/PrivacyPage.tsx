import { APP_NAME, PRIVACY_EMAIL, REPO_URL } from '@/lib/constants';

const LAST_UPDATED = 'October 12, 2026';

const heading = 'text-lg font-semibold tracking-tight';
const link = 'underline underline-offset-4';

export function PrivacyPage() {
  return (
    <>
      <title>{`Privacy policy · ${APP_NAME}`}</title>
      <article className="max-w-2xl space-y-8 text-pretty [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_section]:space-y-2 [&_ul]:space-y-1 [&_ul]:text-muted-foreground">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Privacy policy</h1>
          <p>Last updated {LAST_UPDATED}</p>
        </header>

        <p>
          {APP_NAME} is a portfolio project that helps small nonprofits schedule volunteers. This
          page explains what information it handles and why. Please don't use it to store sensitive
          personal information.
        </p>

        <section>
          <h2 className={heading}>What we collect</h2>
          <ul>
            <li>Your email address, so you can sign in.</li>
            <li>
              If you sign in with Google: your name and profile picture, provided by Google with
              your permission.
            </li>
            <li>
              What you add while using the app, such as organizations, memberships, shifts, and
              volunteer hours.
            </li>
          </ul>
        </section>

        <section>
          <h2 className={heading}>How it's used</h2>
          <p>
            Only to run the app: signing you in, showing you your organizations, and sending sign-in
            emails. {APP_NAME} has no advertising, doesn't sell or share your information, and
            doesn't use analytics or tracking cookies. Your browser stores your sign-in session so
            you stay signed in.
          </p>
        </section>

        <section>
          <h2 className={heading}>Who processes it</h2>
          <ul>
            <li>Supabase: database and sign-in (United States).</li>
            <li>Vercel: hosting.</li>
            <li>Resend: delivering sign-in emails.</li>
            <li>Google: only if you choose to sign in with Google.</li>
          </ul>
        </section>

        <section>
          <h2 className={heading}>Who can see your information</h2>
          <p>
            Other members of an organization you belong to can see your name and your activity in
            that organization. An organization's optional contact details (description, contact
            email, and website) are visible to its members. Access rules are enforced by the
            database itself, not only by the app's screens.
          </p>
        </section>

        <section>
          <h2 className={heading}>Your choices</h2>
          <p>
            To ask what we hold about you, or to have your account and data deleted, email{' '}
            <a href={`mailto:${PRIVACY_EMAIL}`} className={link}>
              {PRIVACY_EMAIL}
            </a>
            . The{' '}
            <a href={REPO_URL} className={link}>
              source code
            </a>{' '}
            is public if you'd like to see exactly how your data is handled.
          </p>
        </section>
      </article>
    </>
  );
}
