import type {
  AuthCredentials,
  EmailValidationError,
  LoginFormErrors,
  PasswordConfirmationError,
  PasswordValidationError,
  ResetPasswordFormErrors,
  SignUpCredentials,
  SignUpFormErrors,
} from './types';

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function validateEmail(email: string): { ok: true; email: string } | { ok: false; error: EmailValidationError } {
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'REQUIRED' };
  }
  if (!isValidEmail(trimmed)) {
    return { ok: false, error: 'INVALID_FORMAT' };
  }
  return { ok: true, email: trimmed };
}

export function validatePassword(password: string): { ok: true; password: string } | { ok: false; error: PasswordValidationError } {
  if (password.length === 0) {
    return { ok: false, error: 'REQUIRED' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: 'TOO_SHORT' };
  }
  return { ok: true, password };
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): { ok: true } | { ok: false; error: PasswordConfirmationError } {
  if (confirmation.length === 0) {
    return { ok: false, error: 'REQUIRED' };
  }
  if (password !== confirmation) {
    return { ok: false, error: 'DOES_NOT_MATCH' };
  }
  return { ok: true };
}

export function validateLoginForm(input: AuthCredentials):
  | { ok: true; data: AuthCredentials }
  | { ok: false; errors: LoginFormErrors } {
  const emailResult = validateEmail(input.email);
  const passwordResult = validatePassword(input.password);

  const errors: LoginFormErrors = {};
  if (!emailResult.ok) {
    errors.email = emailResult.error;
  }
  if (!passwordResult.ok) {
    errors.password = passwordResult.error;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      email: (emailResult as { ok: true; email: string }).email,
      password: (passwordResult as { ok: true; password: string }).password,
    },
  };
}

export function validateSignUpForm(input: SignUpCredentials):
  | { ok: true; data: SignUpCredentials }
  | { ok: false; errors: SignUpFormErrors } {
  const emailResult = validateEmail(input.email);
  const passwordResult = validatePassword(input.password);
  const confirmationResult = validatePasswordConfirmation(input.password, input.passwordConfirmation);

  const errors: SignUpFormErrors = {};
  if (!emailResult.ok) {
    errors.email = emailResult.error;
  }
  if (!passwordResult.ok) {
    errors.password = passwordResult.error;
  }
  if (!confirmationResult.ok) {
    errors.passwordConfirmation = confirmationResult.error;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      email: (emailResult as { ok: true; email: string }).email,
      password: (passwordResult as { ok: true; password: string }).password,
      passwordConfirmation: input.passwordConfirmation,
    },
  };
}

export function validateResetPasswordForm(input: { email: string }):
  | { ok: true; email: string }
  | { ok: false; errors: ResetPasswordFormErrors } {
  const emailResult = validateEmail(input.email);

  if (!emailResult.ok) {
    return { ok: false, errors: { email: emailResult.error } };
  }

  return { ok: true, email: emailResult.email };
}
