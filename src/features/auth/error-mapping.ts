export type AuthErrorMessageKey =
  | 'auth.errors.invalidCredentials'
  | 'auth.errors.userAlreadyExists'
  | 'auth.errors.weakPassword'
  | 'auth.errors.rateLimit'
  | 'auth.errors.emailNotConfirmed'
  | 'auth.errors.networkError'
  | 'auth.errors.unknown';

type ErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

export function mapAuthError(error: unknown): AuthErrorMessageKey {
  if (!error) {
    return 'auth.errors.unknown';
  }

  const err = error as ErrorLike;
  const message = (err.message ?? (error instanceof Error ? error.message : '')).toLowerCase();
  const code = (err.code ?? '').toLowerCase();

  // Invalid credentials
  if (
    code === 'invalid_credentials' ||
    message.includes('invalid login credentials') ||
    message.includes('invalid email or password') ||
    message.includes('invalid grant')
  ) {
    return 'auth.errors.invalidCredentials';
  }

  // User already registered
  if (
    code === 'user_already_exists' ||
    message.includes('user already registered') ||
    message.includes('already exists')
  ) {
    return 'auth.errors.userAlreadyExists';
  }

  // Weak password
  if (
    code === 'weak_password' ||
    message.includes('password should be at least') ||
    message.includes('weak password')
  ) {
    return 'auth.errors.weakPassword';
  }

  // Email not confirmed
  if (
    code === 'email_not_confirmed' ||
    message.includes('email not confirmed')
  ) {
    return 'auth.errors.emailNotConfirmed';
  }

  // Rate limiting
  if (
    code === 'over_request_rate_limit' ||
    code === 'rate_limit' ||
    err.status === 429 ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return 'auth.errors.rateLimit';
  }

  // Network errors
  if (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('connection error')
  ) {
    return 'auth.errors.networkError';
  }

  return 'auth.errors.unknown';
}
