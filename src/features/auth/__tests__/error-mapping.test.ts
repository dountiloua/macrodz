import { describe, expect, it } from '@jest/globals';

import { mapAuthError } from '../error-mapping';

describe('mapAuthError', () => {
  it('maps invalid credentials errors', () => {
    expect(mapAuthError({ message: 'Invalid login credentials' })).toBe(
      'auth.errors.invalidCredentials',
    );
    expect(mapAuthError({ code: 'invalid_credentials' })).toBe('auth.errors.invalidCredentials');
  });

  it('maps user already registered error', () => {
    expect(mapAuthError({ message: 'User already registered' })).toBe(
      'auth.errors.userAlreadyExists',
    );
    expect(mapAuthError({ code: 'user_already_exists' })).toBe('auth.errors.userAlreadyExists');
  });

  it('maps weak password error', () => {
    expect(mapAuthError({ message: 'Password should be at least 8 characters' })).toBe(
      'auth.errors.weakPassword',
    );
    expect(mapAuthError({ code: 'weak_password' })).toBe('auth.errors.weakPassword');
  });

  it('maps email not confirmed error', () => {
    expect(mapAuthError({ message: 'Email not confirmed' })).toBe(
      'auth.errors.emailNotConfirmed',
    );
    expect(mapAuthError({ code: 'email_not_confirmed' })).toBe('auth.errors.emailNotConfirmed');
  });

  it('maps rate limit errors', () => {
    expect(mapAuthError({ message: 'Too many requests' })).toBe('auth.errors.rateLimit');
    expect(mapAuthError({ status: 429 })).toBe('auth.errors.rateLimit');
    expect(mapAuthError({ code: 'over_request_rate_limit' })).toBe('auth.errors.rateLimit');
  });

  it('maps network errors', () => {
    expect(mapAuthError(new Error('Network request failed'))).toBe('auth.errors.networkError');
    expect(mapAuthError({ message: 'Failed to fetch' })).toBe('auth.errors.networkError');
  });

  it('falls back to unknown error', () => {
    expect(mapAuthError(null)).toBe('auth.errors.unknown');
    expect(mapAuthError(new Error('Some unusual database crash'))).toBe('auth.errors.unknown');
  });
});
