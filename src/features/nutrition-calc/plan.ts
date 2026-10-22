import { calculateBmr } from './bmr';
import { GOAL_CALORIE_FACTORS, MIN_CALORIES } from './constants';
import { calculateMacros } from './macros';
import { activityMultiplier } from './tdee';
import type { CalculatorInput, MacroWarning, NutritionPlan } from './types';

function assertValidInput(input: CalculatorInput): void {
  if (input.gender !== 'male' && input.gender !== 'female') {
    throw new RangeError('gender must be male or female');
  }

  if (!Number.isFinite(input.age) || input.age <= 0 || input.age > 120) {
    throw new RangeError('age must be between 1 and 120');
  }

  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    throw new RangeError('weightKg must be a positive number');
  }

  if (!Number.isFinite(input.heightCm) || input.heightCm <= 0) {
    throw new RangeError('heightCm must be a positive number');
  }

  if (
    !Number.isInteger(input.trainingDaysPerWeek) ||
    input.trainingDaysPerWeek < 0 ||
    input.trainingDaysPerWeek > 7
  ) {
    throw new RangeError('trainingDaysPerWeek must be an integer between 0 and 7');
  }

  if (
    input.bodyFatPercent !== undefined &&
    (!Number.isFinite(input.bodyFatPercent) ||
      input.bodyFatPercent <= 0 ||
      input.bodyFatPercent >= 100)
  ) {
    throw new RangeError('bodyFatPercent must be between 0 and 100');
  }

  if (!(input.goal in GOAL_CALORIE_FACTORS)) {
    throw new RangeError('goal must be cut, maintain or lean_bulk');
  }
}

export function calculateNutritionPlan(input: CalculatorInput): NutritionPlan {
  assertValidInput(input);

  const { bmr, formula } = calculateBmr(input);
  const tdee = bmr * activityMultiplier(input.trainingDaysPerWeek);
  const calorieFloor = Math.max(bmr, MIN_CALORIES[input.gender]);
  const goalCalories = Math.round(tdee * GOAL_CALORIE_FACTORS[input.goal]);
  const warnings: MacroWarning[] = [];

  let targetCalories = goalCalories;

  if (targetCalories < calorieFloor) {
    targetCalories = Math.ceil(calorieFloor);
    warnings.push('CALORIES_RAISED_TO_FLOOR');
  }

  const macros = calculateMacros({
    calories: targetCalories,
    weightKg: input.weightKg,
    bodyFatPercent: input.bodyFatPercent,
    goal: input.goal,
  });

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    bmrFormula: formula,
    ...macros,
    warnings: [...warnings, ...macros.warnings],
  };
}
