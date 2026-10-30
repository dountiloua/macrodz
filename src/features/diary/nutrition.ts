import { SERVING_UNITS, type ServingUnit } from '../serving-units';
import type { DiaryEntry, DiaryFood } from './types';

export type LogAmount = { quantity: string; unit: ServingUnit };

export type NutritionValues = { kcal: number; protein: number; carbs: number; fat: number };

export function getNutritionPer100g(
  food: Partial<Pick<DiaryFood, 'kcal' | 'protein' | 'carbs' | 'fat'>>,
): NutritionValues | null {
  if (
    typeof food.kcal !== 'number' ||
    !Number.isFinite(food.kcal) ||
    food.kcal < 0 ||
    typeof food.protein !== 'number' ||
    !Number.isFinite(food.protein) ||
    food.protein < 0 ||
    typeof food.carbs !== 'number' ||
    !Number.isFinite(food.carbs) ||
    food.carbs < 0 ||
    typeof food.fat !== 'number' ||
    !Number.isFinite(food.fat) ||
    food.fat < 0 ||
    (food.kcal === 0 && food.protein === 0 && food.carbs === 0 && food.fat === 0)
  ) {
    return null;
  }
  return {
    kcal: food.kcal,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  };
}

export function hasUsableNutrition(
  food: Partial<Pick<DiaryFood, 'kcal' | 'protein' | 'carbs' | 'fat'>>,
): boolean {
  return getNutritionPer100g(food) !== null;
}

export function getDefaultLogAmount(
  servingQuantityG?: number,
  initialQuantity?: string,
  initialUnit?: string,
): LogAmount {
  if (initialQuantity !== undefined) {
    const unit =
      initialUnit !== undefined && (SERVING_UNITS as readonly string[]).includes(initialUnit)
        ? (initialUnit as ServingUnit)
        : 'g';
    return { quantity: initialQuantity, unit };
  }

  if (servingQuantityG !== undefined && Number.isFinite(servingQuantityG) && servingQuantityG > 0) {
    return { quantity: '1', unit: 'unit' };
  }

  return { quantity: '100', unit: 'g' };
}

export function formatDiaryEntryMacros(
  entry: Pick<DiaryEntry, 'protein' | 'carbs' | 'fat'>,
  labels: { protein: string; carbs: string; fat: string; unit: string },
) {
  return `${labels.protein} ${entry.protein} ${labels.unit} · ${labels.carbs} ${entry.carbs} ${labels.unit} · ${labels.fat} ${entry.fat} ${labels.unit}`;
}
