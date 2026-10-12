import {
  isAuthError,
  isAuthPKCECodeVerifierMissingError,
  isAuthRetryableFetchError,
} from '@supabase/supabase-js';

export type AppErrorCode =
  | 'RATE_LIMITED'
  | 'CODE_INVALID_OR_EXPIRED'
  | 'SIGN_IN_INTERRUPTED'
  | 'INVALID_EMAIL'
  | 'NOT_AUTHORIZED'
  | 'NETWORK'
  | 'UNKNOWN';

export interface AppError {
  code: AppErrorCode;
  message: string;
}

const MESSAGES: Record<AppErrorCode, string> = {
  RATE_LIMITED: 'Too many attempts. Please wait a minute and try again.',
  CODE_INVALID_OR_EXPIRED:
    'That code or link is invalid or has expired. Request a new one and try again.',
  SIGN_IN_INTERRUPTED:
    "We couldn't finish signing you in from this browser. Please start again from the sign-in page.",
  INVALID_EMAIL: "That email address doesn't look right. Check it and try again.",
  NOT_AUTHORIZED: "You don't have permission to do that.",
  NETWORK: "We couldn't reach the server. Check your connection and try again.",
  UNKNOWN: 'Something went wrong. Please try again.',
};

/** Supabase Auth error codes (from API responses and redirect URLs) the app explains to users. */
const AUTH_ERROR_CODES: Partial<Record<string, AppErrorCode>> = {
  over_email_send_rate_limit: 'RATE_LIMITED',
  over_request_rate_limit: 'RATE_LIMITED',
  otp_expired: 'CODE_INVALID_OR_EXPIRED',
  email_address_invalid: 'INVALID_EMAIL',
  flow_state_expired: 'SIGN_IN_INTERRUPTED',
  flow_state_not_found: 'SIGN_IN_INTERRUPTED',
  bad_code_verifier: 'SIGN_IN_INTERRUPTED',
};

function appError(code: AppErrorCode): AppError {
  return { code, message: MESSAGES[code] };
}

/** Maps a Supabase Auth error code (e.g. from a redirect's `error_code` param) to an app error. */
export function fromAuthErrorCode(code: string | null | undefined): AppError {
  const mapped = code ? AUTH_ERROR_CODES[code] : undefined;
  return appError(mapped ?? 'UNKNOWN');
}

function hasStringCode(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
  );
}

/** Converts anything thrown by Supabase or `fetch` into a typed error with a friendly message. */
export function toAppError(error: unknown): AppError {
  if (isAuthRetryableFetchError(error)) return appError('NETWORK');
  if (isAuthPKCECodeVerifierMissingError(error)) return appError('SIGN_IN_INTERRUPTED');
  if (isAuthError(error)) {
    const mapped = error.code ? AUTH_ERROR_CODES[error.code] : undefined;
    if (mapped) return appError(mapped);
    if (error.status === 429) return appError('RATE_LIMITED');
    if (error.status === 401 || error.status === 403) return appError('NOT_AUTHORIZED');
    return appError('UNKNOWN');
  }
  // PostgREST: insufficient privilege (RLS or grants) for the signed-in user.
  if (hasStringCode(error) && error.code === '42501') return appError('NOT_AUTHORIZED');
  // fetch() rejects with a TypeError when the network request itself fails.
  if (error instanceof TypeError) return appError('NETWORK');
  return appError('UNKNOWN');
}
