import type { DiaryFood, LogFoodParams, Meal } from './types';

export function buildLogFoodParams(
  date: string,
  meal: Meal,
  food: DiaryFood,
  edit?: { entryId: string; quantity: number; unit: string },
): LogFoodParams {
  return {
    date,
    meal,
    name: food.name,
    kcal: String(food.kcal),
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
    ...(food.productId ? { productId: food.productId } : {}),
    ...(food.servingQuantityG === undefined
      ? {}
      : { servingQuantityG: String(food.servingQuantityG) }),
    ...(food.densityGPerMl === undefined ? {} : { densityGPerMl: String(food.densityGPerMl) }),
    ...(edit ? { entryId: edit.entryId, quantity: String(edit.quantity), unit: edit.unit } : {}),
  };
}

export function readSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
