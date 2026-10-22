export const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

export const PROTEIN_G_PER_KG = {
  default: 2.0,
  cut: 2.2,
  fallback: 1.6,
} as const;

export const PROTEIN_CAP_LEAN_G_PER_KG = 2.2;
export const PROTEIN_HARD_CAP_G = 220;

export const FAT_G_PER_KG = 0.8;
export const FAT_MIN_CALORIE_RATIO = 0.2;

export const MIN_CALORIES = {
  male: 1500,
  female: 1200,
} as const;

export const ACTIVITY_MULTIPLIERS = [
  { maxDaysPerWeek: 1, multiplier: 1.2 },
  { maxDaysPerWeek: 3, multiplier: 1.375 },
  { maxDaysPerWeek: 5, multiplier: 1.55 },
  { maxDaysPerWeek: 7, multiplier: 1.725 },
] as const;

export const GOAL_CALORIE_FACTORS = {
  cut: 0.8,
  maintain: 1,
  lean_bulk: 1.1,
} as const;
