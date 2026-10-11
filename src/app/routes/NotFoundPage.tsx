import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';

export function NotFoundPage() {
  return (
    <>
      <title>{`Page not found · ${APP_NAME}`}</title>
      <div className="flex flex-col items-start gap-4 py-12">
        <p className="text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground">
          The page you're looking for doesn't exist or has moved.
        </p>
        <Button asChild>
          <Link to="/">Go to home</Link>
        </Button>
      </div>
    </>
  );
}
