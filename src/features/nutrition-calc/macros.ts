import {
  FAT_G_PER_KG,
  FAT_MIN_CALORIE_RATIO,
  KCAL_PER_GRAM,
  PROTEIN_CAP_LEAN_G_PER_KG,
  PROTEIN_G_PER_KG,
  PROTEIN_HARD_CAP_G,
} from './constants';
import type { MacroInput, MacroResult, MacroWarning } from './types';

function remainingKcal(calories: number, proteinG: number, fatG: number): number {
  return calories - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat;
}

function fatMinimumG(calories: number): number {
  return Math.round((calories * FAT_MIN_CALORIE_RATIO) / KCAL_PER_GRAM.fat);
}

function maxProteinG(weightKg: number, bodyFatPercent?: number): number {
  if (bodyFatPercent !== undefined) {
    const leanMassKg = weightKg * (1 - bodyFatPercent / 100);
    return Math.round(PROTEIN_CAP_LEAN_G_PER_KG * leanMassKg);
  }

  return PROTEIN_HARD_CAP_G;
}

export function calculateMacros({
  calories: targetCalories,
  weightKg,
  bodyFatPercent,
  goal,
}: MacroInput): MacroResult {
  const warnings: MacroWarning[] = [];

  const proteinPerKg = goal === 'cut' ? PROTEIN_G_PER_KG.cut : PROTEIN_G_PER_KG.default;
  const proteinCapG = maxProteinG(weightKg, bodyFatPercent);
  const preferredProteinG = Math.round(proteinPerKg * weightKg);
  let proteinG = Math.min(preferredProteinG, proteinCapG);

  if (proteinG < preferredProteinG) {
    warnings.push('PROTEIN_CAPPED');
  }

  let fatG = Math.round(
    Math.max(FAT_G_PER_KG * weightKg, (targetCalories * FAT_MIN_CALORIE_RATIO) / KCAL_PER_GRAM.fat),
  );
  let remaining = remainingKcal(targetCalories, proteinG, fatG);

  if (remaining < 0) {
    const fatFloorG = fatMinimumG(targetCalories);

    if (fatFloorG < fatG) {
      fatG = fatFloorG;
      warnings.push('FAT_REDUCED_TO_FLOOR');
    }

    remaining = remainingKcal(targetCalories, proteinG, fatG);
  }

  if (remaining < 0) {
    const fallbackProteinG = Math.min(
      Math.round(PROTEIN_G_PER_KG.fallback * weightKg),
      proteinCapG,
    );

    if (fallbackProteinG < proteinG) {
      proteinG = fallbackProteinG;
      warnings.push('PROTEIN_REDUCED');
    }

    remaining = remainingKcal(targetCalories, proteinG, fatG);
  }

  let calories = targetCalories;

  if (remaining < 0) {
    calories = proteinG * KCAL_PER_GRAM.protein + fatG * KCAL_PER_GRAM.fat;
    remaining = 0;
    warnings.push('CALORIES_RAISED');
  }

  const carbsG = Math.max(0, Math.round(remaining / KCAL_PER_GRAM.carbs));

  return { calories, proteinG, fatG, carbsG, warnings };
}
