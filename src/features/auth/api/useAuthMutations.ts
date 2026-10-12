import { useMutation } from '@tanstack/react-query';
import { sendSignInEmail, startGoogleSignIn, verifyEmailCode } from '@/features/auth/api/authApi';

export function useSendSignInEmail() {
  return useMutation({ mutationFn: sendSignInEmail });
}

export function useVerifyEmailCode() {
  return useMutation({ mutationFn: verifyEmailCode });
}

export function useStartGoogleSignIn() {
  return useMutation({ mutationFn: startGoogleSignIn });
}
