import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  reset: () => void;
  title?: string;
  message?: string;
}

export function ErrorFallback({
  reset,
  title = 'Something went wrong',
  message = "This section couldn't load. Try again, and if it keeps happening, reload the page.",
}: ErrorFallbackProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
    >
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlert aria-hidden="true" className="size-4 text-destructive" />
        {title}
      </p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
