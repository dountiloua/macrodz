import { describe, expect, it } from '@jest/globals';

import {
  isValidEmail,
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validateLoginForm,
  validatePassword,
  validatePasswordConfirmation,
  validateResetPasswordForm,
  validateSignUpForm,
} from '../validation';

describe('auth validation', () => {
  describe('validateEmail', () => {
    it('accepts valid email addresses', () => {
      expect(validateEmail('test@example.com')).toEqual({ ok: true, email: 'test@example.com' });
      expect(validateEmail('  user.name+tag@sub.domain.dz  ')).toEqual({
        ok: true,
        email: 'user.name+tag@sub.domain.dz',
      });
    });

    it('rejects empty or whitespace-only emails', () => {
      expect(validateEmail('')).toEqual({ ok: false, error: 'REQUIRED' });
      expect(validateEmail('   ')).toEqual({ ok: false, error: 'REQUIRED' });
    });

    it('rejects invalid email formats', () => {
      expect(validateEmail('plainaddress')).toEqual({ ok: false, error: 'INVALID_FORMAT' });
      expect(validateEmail('@missingusername.com')).toEqual({ ok: false, error: 'INVALID_FORMAT' });
      expect(validateEmail('username@.com')).toEqual({ ok: false, error: 'INVALID_FORMAT' });
      expect(validateEmail('username@domain')).toEqual({ ok: false, error: 'INVALID_FORMAT' });
    });

    it('isValidEmail returns boolean directly', () => {
      expect(isValidEmail('test@macrodz.com')).toBe(true);
      expect(isValidEmail('bademail')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('accepts passwords of 8 characters or more', () => {
      expect(validatePassword('12345678')).toEqual({ ok: true, password: '12345678' });
      expect(validatePassword('StrongPassword123!')).toEqual({
        ok: true,
        password: 'StrongPassword123!',
      });
    });

    it('rejects empty password', () => {
      expect(validatePassword('')).toEqual({ ok: false, error: 'REQUIRED' });
    });

    it(`rejects passwords shorter than ${MIN_PASSWORD_LENGTH} characters`, () => {
      expect(validatePassword('1234567')).toEqual({ ok: false, error: 'TOO_SHORT' });
      expect(validatePassword('abc')).toEqual({ ok: false, error: 'TOO_SHORT' });
    });
  });

  describe('validatePasswordConfirmation', () => {
    it('accepts matching confirmation', () => {
      expect(validatePasswordConfirmation('secret123', 'secret123')).toEqual({ ok: true });
    });

    it('rejects empty confirmation', () => {
      expect(validatePasswordConfirmation('secret123', '')).toEqual({
        ok: false,
        error: 'REQUIRED',
      });
    });

    it('rejects mismatching confirmation', () => {
      expect(validatePasswordConfirmation('secret123', 'different')).toEqual({
        ok: false,
        error: 'DOES_NOT_MATCH',
      });
    });
  });

  describe('validateLoginForm', () => {
    it('validates a complete, valid login form', () => {
      const result = validateLoginForm({ email: 'user@example.com', password: 'password123' });
      expect(result).toEqual({
        ok: true,
        data: { email: 'user@example.com', password: 'password123' },
      });
    });

    it('returns errors for invalid email and too short password', () => {
      const result = validateLoginForm({ email: 'bademail', password: '123' });
      expect(result).toEqual({
        ok: false,
        errors: { email: 'INVALID_FORMAT', password: 'TOO_SHORT' },
      });
    });

    it('returns required errors when empty', () => {
      const result = validateLoginForm({ email: '', password: '' });
      expect(result).toEqual({
        ok: false,
        errors: { email: 'REQUIRED', password: 'REQUIRED' },
      });
    });
  });

  describe('validateSignUpForm', () => {
    it('validates a complete, matching signup form', () => {
      const result = validateSignUpForm({
        email: 'user@example.com',
        password: 'password123',
        passwordConfirmation: 'password123',
      });
      expect(result).toEqual({
        ok: true,
        data: {
          email: 'user@example.com',
          password: 'password123',
          passwordConfirmation: 'password123',
        },
      });
    });

    it('rejects invalid email addresses and passwords shorter than 8 characters', () => {
      expect(
        validateSignUpForm({
          email: 'not-an-email',
          password: 'short',
          passwordConfirmation: 'short',
        }),
      ).toEqual({
        ok: false,
        errors: { email: 'INVALID_FORMAT', password: 'TOO_SHORT' },
      });
    });

    it('catches password confirmation mismatch', () => {
      const result = validateSignUpForm({
        email: 'user@example.com',
        password: 'password123',
        passwordConfirmation: 'mismatch123',
      });
      expect(result).toEqual({
        ok: false,
        errors: { passwordConfirmation: 'DOES_NOT_MATCH' },
      });
    });

    it('requires a password confirmation', () => {
      expect(
        validateSignUpForm({
          email: 'user@example.com',
          password: 'password123',
          passwordConfirmation: '',
        }),
      ).toEqual({
        ok: false,
        errors: { passwordConfirmation: 'REQUIRED' },
      });
    });
  });

  describe('validateResetPasswordForm', () => {
    it('validates a valid reset password email', () => {
      expect(validateResetPasswordForm({ email: 'user@example.com' })).toEqual({
        ok: true,
        email: 'user@example.com',
      });
    });

    it('rejects an invalid reset password email', () => {
      expect(validateResetPasswordForm({ email: 'bad' })).toEqual({
        ok: false,
        errors: { email: 'INVALID_FORMAT' },
      });
    });
  });
});
