import type { ServingProduct } from '@/features/serving-units';

export function hasInconsistentCalories(product: ServingProduct): boolean {
  const expected =
    4 * product.protein +
    4 * product.carbs +
    9 * product.fat +
    7 * (product.alcohol ?? 0);

  if (product.kcal < 10 && expected < 10) return false;
  return Math.abs(product.kcal - expected) > Math.max(20, product.kcal * 0.2);
}
