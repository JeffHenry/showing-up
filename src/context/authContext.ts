import type { Session, User } from '@supabase/supabase-js';
import { createContext } from 'react';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  /** `loading` until Supabase has read any stored session. */
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** Ends this device's session; cached data is cleared when the sign-out takes effect. */
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
