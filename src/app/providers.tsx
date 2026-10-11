import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/lib/queryClient';

/** App-wide providers. Auth and organization context join here in P0. */
export function AppProviders({ children }: { children: ReactNode }) {
  // Created once per app instance (not at module scope), so tests never share a cache.
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
