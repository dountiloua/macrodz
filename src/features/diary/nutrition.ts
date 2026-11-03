import { getAvailableServingUnits, SERVING_UNITS, type ServingUnit } from '../serving-units';
import { getVolumeUnitMl } from '../serving-units';
import type { DiaryEntry, DiaryFood } from './types';

export type LogAmount = { quantity: string; unit: ServingUnit };

export function getLogFoodUnitOptions(food: DiaryFood): ServingUnit[] {
  return getAvailableServingUnits(food, food.name);
}

export type NutritionValues = { kcal: number; protein: number; carbs: number; fat: number };

export function isDiaryEntryLiquid(entry: {
  unit?: ServingUnit;
  quantity?: number;
  grams: number;
}): boolean {
  if (
    entry.unit === 'cl' ||
    entry.unit === 'dl' ||
    entry.unit === 'l' ||
    entry.unit === 'fl_oz'
  ) {
    return true;
  }
  if (
    entry.unit === undefined ||
    !['ml', 'cup', 'tbsp', 'tsp', 'glass'].includes(entry.unit)
  ) {
    return false;
  }
  if (entry.quantity === undefined) return entry.unit === 'ml';
  if (entry.quantity <= 0) return false;
  const milliliters = getVolumeUnitMl(entry.unit);
  if (milliliters === undefined) return false;
  const density = entry.grams / (entry.quantity * milliliters);
  return Number.isFinite(density) && Math.abs(density - 1) <= 0.02;
}

export function getNutritionPer100g(
  food: Partial<Pick<DiaryFood, 'kcal' | 'protein' | 'carbs' | 'fat' | 'kind'>>,
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
    (food.kcal === 0 &&
      food.protein === 0 &&
      food.carbs === 0 &&
      food.fat === 0 &&
      food.kind !== 'liquid')
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
  food: Partial<Pick<DiaryFood, 'kcal' | 'protein' | 'carbs' | 'fat' | 'kind'>>,
): boolean {
  return getNutritionPer100g(food) !== null;
}

export function getDefaultLogAmount(
  servingQuantityG?: number,
  initialQuantity?: string,
  initialUnit?: string,
  kind: DiaryFood['kind'] = 'solid',
): LogAmount {
  if (initialQuantity !== undefined) {
    const unit =
      initialUnit !== undefined && (SERVING_UNITS as readonly string[]).includes(initialUnit)
        ? (initialUnit as ServingUnit)
        : 'g';
    return { quantity: initialQuantity, unit };
  }

  if (servingQuantityG !== undefined && Number.isFinite(servingQuantityG) && servingQuantityG > 0) {
    return { quantity: String(servingQuantityG), unit: kind === 'liquid' ? 'ml' : 'g' };
  }

  return { quantity: '100', unit: kind === 'liquid' ? 'ml' : 'g' };
}

export function formatDiaryEntryMacros(
  entry: Pick<DiaryEntry, 'protein' | 'carbs' | 'fat'>,
  labels: { protein: string; carbs: string; fat: string; unit: string },
) {
  return `${labels.protein} ${entry.protein.toFixed(1)} ${labels.unit} · ${labels.carbs} ${entry.carbs.toFixed(1)} ${labels.unit} · ${labels.fat} ${entry.fat.toFixed(1)} ${labels.unit}`;
}
