import type { DiaryFood, LogFoodParams, Meal } from './types';
import type { ServingUnit } from '../serving-units';

export function buildLogFoodParams(
  date: string,
  meal: Meal,
  food: DiaryFood,
  edit?: { entryId: string; quantity: number; unit: string },
  prefill?: { quantity: string; unit: ServingUnit },
): LogFoodParams {
  return {
    date,
    meal,
    name: food.name,
    kcal: String(food.kcal),
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
    ...(food.sugars === undefined ? {} : { sugars: String(food.sugars) }),
    ...(food.fiber === undefined ? {} : { fiber: String(food.fiber) }),
    ...(food.saturatedFat === undefined ? {} : { saturatedFat: String(food.saturatedFat) }),
    ...(food.salt === undefined ? {} : { salt: String(food.salt) }),
    ...(food.alcohol === undefined ? {} : { alcohol: String(food.alcohol) }),
    ...(food.brand ? { brand: food.brand } : {}),
    ...(food.barcode ? { barcode: food.barcode } : {}),
    ...(food.imageUrl ? { imageUrl: food.imageUrl } : {}),
    ...(food.source ? { source: food.source } : {}),
    ...(food.kind ? { kind: food.kind } : {}),
    ...(food.productId ? { productId: food.productId } : {}),
    ...(food.servingQuantityG === undefined
      ? {}
      : { servingQuantityG: String(food.servingQuantityG) }),
    ...(food.densityGPerMl === undefined ? {} : { densityGPerMl: String(food.densityGPerMl) }),
    ...(edit ? { entryId: edit.entryId, quantity: String(edit.quantity), unit: edit.unit } : {}),
    ...(prefill ? { quantity: prefill.quantity, unit: prefill.unit } : {}),
  };
}

export function readSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
