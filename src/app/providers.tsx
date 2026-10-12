import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthProvider';
import { createQueryClient } from '@/lib/queryClient';

/** App-wide providers. Organization context joins here with the Organizations feature. */
export function AppProviders({ children }: { children: ReactNode }) {
  // Created once per app instance (not at module scope), so tests never share a cache.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
