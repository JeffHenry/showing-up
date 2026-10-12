import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AuthContext, type AuthStatus } from '@/context/authContext';

/**
 * The Supabase client (~55 KB gzipped, plus Zod for env validation) loads after first paint
 * instead of in the initial bundle: no page needs it to render. Pages that call Supabase are lazy
 * routes, so they share the same chunk.
 */
const loadSupabase = async () => (await import('@/lib/supabase')).supabase;

/** Tracks the Supabase session for the whole app. Read it with `useAuth()`. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void loadSupabase().then((supabase) => {
      if (cancelled) return;
      // Fires INITIAL_SESSION once on subscribe, then on every sign-in, sign-out, and token
      // refresh. Never await Supabase calls inside this callback: the client holds a lock while
      // it runs.
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        const nextUserId = nextSession?.user.id ?? null;
        if (userIdRef.current !== null && userIdRef.current !== nextUserId) {
          // Signed out or switched accounts: never show the previous user's cached data.
          queryClient.clear();
        }
        userIdRef.current = nextUserId;
        setSession(nextSession);
        setStatus(nextSession ? 'authenticated' : 'unauthenticated');
      });
      unsubscribe = () => {
        subscription.unsubscribe();
      };
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient]);

  async function signOut() {
    const supabase = await loadSupabase();
    // 'local' signs out this browser only, not the user's other devices.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }

  return (
    <AuthContext value={{ status, session, user: session?.user ?? null, signOut }}>
      {children}
    </AuthContext>
  );
}
