import { CalendarPlus, Clock, ExternalLink, UserCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { APP_NAME, REPO_URL } from '@/lib/constants';

const HIGHLIGHTS = [
  {
    icon: CalendarPlus,
    title: 'Post shifts in minutes',
    body: 'Coordinators publish shifts with times, locations, and how many people they need.',
  },
  {
    icon: UserCheck,
    title: 'Claim a spot from any phone',
    body: 'Volunteers see open shifts and claim one in a tap. The last spot can never be double-booked.',
  },
  {
    icon: Clock,
    title: 'Track and approve hours',
    body: 'Volunteers log their hours; coordinators approve them and export reports for funders.',
  },
] as const;

export function LandingPage() {
  return (
    <>
      <title>{`${APP_NAME} · Volunteer scheduling for small nonprofits`}</title>

      <section aria-labelledby="hero-heading" className="py-6 sm:py-14">
        <h1
          id="hero-heading"
          className="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl"
        >
          Volunteer scheduling without the spreadsheets.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
          {APP_NAME} helps small nonprofits post shifts, fill them, and keep track of volunteer
          hours, all in one place instead of group texts and shared spreadsheets.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={REPO_URL}>
              View the source on GitHub
              <ExternalLink aria-hidden="true" data-icon="inline-end" />
            </a>
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          In active development: sign-in works today; organizations and scheduling are next.
        </p>
      </section>

      <section aria-labelledby="highlights-heading" className="py-6">
        <h2 id="highlights-heading" className="text-xl font-semibold tracking-tight">
          What you'll be able to do
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-lg border p-5">
              <Icon aria-hidden="true" className="size-6" />
              <h3 className="mt-3 font-medium">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
