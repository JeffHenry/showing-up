import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  // The live region is always rendered so assistive tech announces the message when it appears.
  return (
    <div role="status">
      {!isOnline && (
        <p className="flex items-center justify-center gap-2 bg-muted px-4 py-2 text-center text-sm">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          You're offline. You can keep viewing what's loaded; changes need a connection.
        </p>
      )}
    </div>
  );
}
