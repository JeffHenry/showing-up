import { use } from 'react';
import { AuthContext, type AuthContextValue } from '@/context/authContext';

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
