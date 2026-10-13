import {
  AuthApiError,
  AuthPKCECodeVerifierMissingError,
  AuthRetryableFetchError,
} from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { AppException, fromAuthErrorCode, toAppError } from '@/lib/errors';

describe('toAppError', () => {
  it.each([
    [
      'email rate limit',
      new AuthApiError('rate', 429, 'over_email_send_rate_limit'),
      'RATE_LIMITED',
    ],
    [
      'request rate limit',
      new AuthApiError('rate', 429, 'over_request_rate_limit'),
      'RATE_LIMITED',
    ],
    ['an unknown 429', new AuthApiError('slow down', 429, undefined), 'RATE_LIMITED'],
    [
      'an expired or wrong code',
      new AuthApiError('bad', 403, 'otp_expired'),
      'CODE_INVALID_OR_EXPIRED',
    ],
    ['an invalid email', new AuthApiError('bad', 400, 'email_address_invalid'), 'INVALID_EMAIL'],
    [
      'an expired OAuth flow',
      new AuthApiError('gone', 400, 'flow_state_expired'),
      'SIGN_IN_INTERRUPTED',
    ],
    ['a missing PKCE verifier', new AuthPKCECodeVerifierMissingError(), 'SIGN_IN_INTERRUPTED'],
    ['a forbidden auth request', new AuthApiError('no', 403, 'something_new'), 'NOT_AUTHORIZED'],
    ['an auth network failure', new AuthRetryableFetchError('offline', 0), 'NETWORK'],
    ['a fetch TypeError', new TypeError('Failed to fetch'), 'NETWORK'],
    [
      'a PostgREST permission error',
      { code: '42501', message: 'permission denied' },
      'NOT_AUTHORIZED',
    ],
    [
      'a taken organization short name',
      { code: 'P0001', message: 'SLUG_TAKEN', details: 'In use.' },
      'SLUG_TAKEN',
    ],
    [
      'the organization creation limit',
      { code: 'P0001', message: 'ORG_LIMIT_REACHED' },
      'ORG_LIMIT_REACHED',
    ],
    ['removing the last owner', { code: 'P0001', message: 'LAST_OWNER' }, 'LAST_OWNER'],
    ['an unknown invite link', { code: 'P0001', message: 'INVITE_NOT_FOUND' }, 'INVITE_NOT_FOUND'],
    ['an expired invite link', { code: 'P0001', message: 'INVITE_EXPIRED' }, 'INVITE_EXPIRED'],
    ['a used invite link', { code: 'P0001', message: 'INVITE_USED' }, 'INVITE_USED'],
    [
      'the pending invite limit',
      { code: 'P0001', message: 'INVITE_LIMIT_REACHED' },
      'INVITE_LIMIT_REACHED',
    ],
    ['a shift starting in the past', { code: 'P0001', message: 'SHIFT_IN_PAST' }, 'SHIFT_IN_PAST'],
    ['a shift over a year ahead', { code: 'P0001', message: 'SHIFT_TOO_FAR' }, 'SHIFT_TOO_FAR'],
    ['a shift that has started', { code: 'P0001', message: 'SHIFT_STARTED' }, 'SHIFT_STARTED'],
    ['a cancelled shift', { code: 'P0001', message: 'SHIFT_CANCELLED' }, 'SHIFT_CANCELLED'],
    ['a conflict the app detected', new AppException('SHIFT_CHANGED'), 'SHIFT_CHANGED'],
    ['an unrecognized database error', { code: 'P0001', message: 'SOMETHING_NEW' }, 'UNKNOWN'],
    ['a rejected value', { code: '23514', message: 'violates check constraint' }, 'INVALID_INPUT'],
    ['an unexpected auth error', new AuthApiError('boom', 400, 'something_new'), 'UNKNOWN'],
    ['anything else', new Error('boom'), 'UNKNOWN'],
  ])('maps %s', (_label, error, code) => {
    expect(toAppError(error).code).toBe(code);
  });

  it('always includes a user-facing message', () => {
    expect(toAppError(new Error('internal details')).message).toBe(
      'Something went wrong. Please try again.',
    );
  });
});

describe('fromAuthErrorCode', () => {
  it('maps known redirect error codes and defaults the rest', () => {
    expect(fromAuthErrorCode('otp_expired').code).toBe('CODE_INVALID_OR_EXPIRED');
    expect(fromAuthErrorCode('access_denied').code).toBe('UNKNOWN');
    expect(fromAuthErrorCode(null).code).toBe('UNKNOWN');
  });
});
