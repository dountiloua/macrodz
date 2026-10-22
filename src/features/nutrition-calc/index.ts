export { calculateBmr } from './bmr';
export { calculateMacros } from './macros';
export { calculateNutritionPlan } from './plan';
export { activityMultiplier, calculateTdee } from './tdee';
export { ONBOARDING_LIMITS, validateNumericField } from './validation';
export type { NumericField, ValidationCode, ValidationResult } from './validation';
export type {
  BmrFormula,
  BmrInput,
  BmrResult,
  CalculatorInput,
  Gender,
  Goal,
  MacroInput,
  MacroResult,
  MacroWarning,
  NutritionPlan,
} from './types';
