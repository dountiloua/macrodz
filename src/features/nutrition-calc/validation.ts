export const ONBOARDING_LIMITS = {
  age: { min: 18, max: 90 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 35, max: 300 },
  bodyFatPercent: { min: 3, max: 60 },
  trainingDaysPerWeek: { min: 0, max: 7 },
} as const;

export type NumericField = keyof typeof ONBOARDING_LIMITS;

export type ValidationCode =
  | 'REQUIRED'
  | 'INVALID_NUMBER'
  | 'AGE_TOO_LOW'
  | 'AGE_TOO_HIGH'
  | 'HEIGHT_OUT_OF_RANGE'
  | 'WEIGHT_OUT_OF_RANGE'
  | 'BODY_FAT_OUT_OF_RANGE'
  | 'TRAINING_DAYS_OUT_OF_RANGE';

export type ValidationResult =
  { valid: true; value: number } | { valid: false; code: ValidationCode };

const RANGE_CODES = {
  heightCm: 'HEIGHT_OUT_OF_RANGE',
  weightKg: 'WEIGHT_OUT_OF_RANGE',
  bodyFatPercent: 'BODY_FAT_OUT_OF_RANGE',
  trainingDaysPerWeek: 'TRAINING_DAYS_OUT_OF_RANGE',
} as const;

const INTEGER_FIELDS: readonly NumericField[] = ['age', 'trainingDaysPerWeek'];

export function validateNumericField(field: NumericField, rawValue: string): ValidationResult {
  const normalized = rawValue.trim().replace(',', '.');

  if (normalized.length === 0) {
    return { valid: false, code: 'REQUIRED' };
  }

  const value = Number(normalized);

  if (!Number.isFinite(value)) {
    return { valid: false, code: 'INVALID_NUMBER' };
  }

  if (INTEGER_FIELDS.includes(field) && !Number.isInteger(value)) {
    return { valid: false, code: 'INVALID_NUMBER' };
  }

  const { min, max } = ONBOARDING_LIMITS[field];

  if (value < min) {
    return { valid: false, code: field === 'age' ? 'AGE_TOO_LOW' : RANGE_CODES[field] };
  }

  if (value > max) {
    return { valid: false, code: field === 'age' ? 'AGE_TOO_HIGH' : RANGE_CODES[field] };
  }

  return { valid: true, value };
}
