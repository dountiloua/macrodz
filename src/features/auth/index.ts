export { mapAuthError } from './error-mapping';
export type { AuthErrorMessageKey } from './error-mapping';
export {
  fetchProfileFromSupabase,
  mapDbProfileToLocal,
  mapLocalProfileToDb,
  syncProfileToSupabase,
} from './sync-profile';
export type {
  AuthCredentials,
  DbProfileRow,
  EmailValidationError,
  LoginFormErrors,
  PasswordConfirmationError,
  PasswordValidationError,
  ResetPasswordFormErrors,
  SignUpCredentials,
  SignUpFormErrors,
} from './types';
export {
  isValidEmail,
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validateLoginForm,
  validatePassword,
  validatePasswordConfirmation,
  validateResetPasswordForm,
  validateSignUpForm,
} from './validation';
