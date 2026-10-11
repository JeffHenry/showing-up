/** Shown while the first page's code downloads, before the layout can render. */
export function LoadingScreen() {
  return (
    <div role="status" className="flex min-h-svh items-center justify-center">
      <span className="sr-only">Loading ShowingUp…</span>
      <span
        aria-hidden="true"
        className="size-8 animate-spin rounded-full border-4 border-muted border-t-foreground motion-reduce:animate-none"
      />
    </div>
  );
}
