import { hasUsableNutrition } from '@/features/diary/nutrition';
import { lookupProduct } from '@/features/food-lookup';
import type { LookupError, LookupResult, ParsedProduct } from '@/features/food-lookup';

type Lookup = (barcode: string) => Promise<LookupResult>;

export type BuildMealScanResult =
  | { ok: true; product: ParsedProduct }
  | { ok: false; reason: 'lookup-error'; error: LookupError }
  | { ok: false; reason: 'nutrition-missing'; product: ParsedProduct };

export async function scanBuildMealProduct(
  barcode: string,
  lookup: Lookup = lookupProduct,
): Promise<BuildMealScanResult> {
  const result = await lookup(barcode);
  if (!result.ok) return { ok: false, reason: 'lookup-error', error: result.error };

  const { product } = result;
  const nutrition = {
    kind: product.kind,
    kcal: product.kcal,
    protein: product.protein,
    carbs: product.carbs,
    fat: product.fat,
  };
  if (
    !hasUsableNutrition(nutrition) ||
    ![product.kcal, product.protein, product.carbs, product.fat].some((value) => value > 0)
  ) {
    return { ok: false, reason: 'nutrition-missing', product };
  }

  return { ok: true, product };
}
