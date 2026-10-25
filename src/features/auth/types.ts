import type { Gender, Goal, NutritionPlan } from '../nutrition-calc';

export type AuthCredentials = {
  email: string;
  password: string;
};

export type SignUpCredentials = AuthCredentials & {
  passwordConfirmation: string;
};

export type EmailValidationError = 'REQUIRED' | 'INVALID_FORMAT';
export type PasswordValidationError = 'REQUIRED' | 'TOO_SHORT';
export type PasswordConfirmationError = 'REQUIRED' | 'DOES_NOT_MATCH';

export type LoginFormErrors = {
  email?: EmailValidationError;
  password?: PasswordValidationError;
};

export type SignUpFormErrors = LoginFormErrors & {
  passwordConfirmation?: PasswordConfirmationError;
};

export type ResetPasswordFormErrors = {
  email?: EmailValidationError;
};

export type DbProfileRow = {
  id: string;
  gender: Gender;
  birth_year: number;
  height_cm: number;
  weight_kg: number;
  goal: 'cut' | 'maintain' | 'lean_bulk';
  training_days: number;
  body_fat_pct: number | null;
  target_kcal: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  target_bmr_kcal?: number | null;
  target_tdee_kcal?: number | null;
};
