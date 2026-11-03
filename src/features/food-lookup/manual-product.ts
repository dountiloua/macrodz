import type { ProductKind } from '../serving-units';

import { getDefaultCache } from './lookup';
import type { ParsedProduct, ProductCache } from './types';

const MAX_KCAL_PER_100G = 900;
const MAX_MACRO_SUM_PER_100G = 100;

export type ManualProductInput = {
  kind?: ProductKind;
  barcode: string;
  name: string;
  brand?: string;
  kcal: string | number;
  protein: string | number;
  carbs: string | number;
  fat: string | number;
  sugars?: string | number;
  fiber?: string | number;
  saturatedFat?: string | number;
  salt?: string | number;
  alcohol?: string | number;
  servingQuantityG?: string | number;
};

export type ManualProductValidationErrors = {
  name?: 'REQUIRED';
  kcal?: 'REQUIRED' | 'INVALID_NUMBER' | 'EXCEEDS_MAX';
  protein?: 'REQUIRED' | 'INVALID_NUMBER';
  carbs?: 'REQUIRED' | 'INVALID_NUMBER';
  fat?: 'REQUIRED' | 'INVALID_NUMBER';
  sugars?: 'INVALID_NUMBER';
  fiber?: 'INVALID_NUMBER';
  saturatedFat?: 'INVALID_NUMBER';
  salt?: 'INVALID_NUMBER';
  alcohol?: 'INVALID_NUMBER';
  servingQuantityG?: 'INVALID_NUMBER';
  macrosSum?: 'MACROS_EXCEED_100';
};

export type ManualProductValidationResult =
  { ok: true; product: ParsedProduct } | { ok: false; errors: ManualProductValidationErrors };

function parseLocalizedNumber(value: string | number | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const trimmed = value.trim().replace(',', '.');
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateManualProduct(input: ManualProductInput): ManualProductValidationResult {
  const errors: ManualProductValidationErrors = {};

  const barcode = input.barcode.trim();
  const name = input.name.trim();

  if (name.length === 0) {
    errors.name = 'REQUIRED';
  }

  const rawKcal = parseLocalizedNumber(input.kcal);
  if (rawKcal === null) {
    errors.kcal = 'REQUIRED';
  } else if (rawKcal < 0) {
    errors.kcal = 'INVALID_NUMBER';
  } else if (rawKcal > MAX_KCAL_PER_100G) {
    errors.kcal = 'EXCEEDS_MAX';
  }

  const rawProtein = parseLocalizedNumber(input.protein);
  if (rawProtein === null) {
    errors.protein = 'REQUIRED';
  } else if (rawProtein < 0) {
    errors.protein = 'INVALID_NUMBER';
  }

  const rawCarbs = parseLocalizedNumber(input.carbs);
  if (rawCarbs === null) {
    errors.carbs = 'REQUIRED';
  } else if (rawCarbs < 0) {
    errors.carbs = 'INVALID_NUMBER';
  }

  const rawFat = parseLocalizedNumber(input.fat);
  if (rawFat === null) {
    errors.fat = 'REQUIRED';
  } else if (rawFat < 0) {
    errors.fat = 'INVALID_NUMBER';
  }

  const optionalNutrients = {
    sugars: parseLocalizedNumber(input.sugars),
    fiber: parseLocalizedNumber(input.fiber),
    saturatedFat: parseLocalizedNumber(input.saturatedFat),
    salt: parseLocalizedNumber(input.salt),
    alcohol: parseLocalizedNumber(input.alcohol),
  };
  if (optionalNutrients.sugars !== null && optionalNutrients.sugars < 0) {
    errors.sugars = 'INVALID_NUMBER';
  }
  if (optionalNutrients.fiber !== null && optionalNutrients.fiber < 0) {
    errors.fiber = 'INVALID_NUMBER';
  }
  if (optionalNutrients.saturatedFat !== null && optionalNutrients.saturatedFat < 0) {
    errors.saturatedFat = 'INVALID_NUMBER';
  }
  if (optionalNutrients.salt !== null && optionalNutrients.salt < 0) {
    errors.salt = 'INVALID_NUMBER';
  }
  if (optionalNutrients.alcohol !== null && optionalNutrients.alcohol < 0) {
    errors.alcohol = 'INVALID_NUMBER';
  }

  let servingQuantityG: number | undefined;
  if (input.servingQuantityG !== undefined && String(input.servingQuantityG).trim().length > 0) {
    const rawServing = parseLocalizedNumber(input.servingQuantityG);
    if (rawServing === null || rawServing <= 0) {
      errors.servingQuantityG = 'INVALID_NUMBER';
    } else {
      servingQuantityG = rawServing;
    }
  }

  if (rawProtein !== null && rawCarbs !== null && rawFat !== null) {
    if (rawProtein >= 0 && rawCarbs >= 0 && rawFat >= 0) {
      if (rawProtein + rawCarbs + rawFat > MAX_MACRO_SUM_PER_100G) {
        errors.macrosSum = 'MACROS_EXCEED_100';
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const brand = input.brand?.trim();
  const kind = input.kind ?? 'solid';

  const product: ParsedProduct = {
    kind,
    barcode,
    name,
    brand: brand && brand.length > 0 ? brand : undefined,
    kcal: rawKcal!,
    protein: rawProtein!,
    carbs: rawCarbs!,
    fat: rawFat!,
    ...(optionalNutrients.sugars === null ? {} : { sugars: optionalNutrients.sugars }),
    ...(optionalNutrients.fiber === null ? {} : { fiber: optionalNutrients.fiber }),
    ...(optionalNutrients.saturatedFat === null
      ? {}
      : { saturatedFat: optionalNutrients.saturatedFat }),
    ...(optionalNutrients.salt === null ? {} : { salt: optionalNutrients.salt }),
    ...(optionalNutrients.alcohol === null ? {} : { alcohol: optionalNutrients.alcohol }),
    servingQuantityG,
    servingSize: servingQuantityG
      ? `${servingQuantityG} ${kind === 'liquid' ? 'ml' : 'g'}`
      : undefined,
    countriesTags: [],
    isLikelyAlgerian: barcode.startsWith('613'),
    source: 'user',
  };

  return { ok: true, product };
}

export async function saveManualProduct(
  product: ParsedProduct,
  cache?: ProductCache,
): Promise<void> {
  const targetCache = cache ?? (await getDefaultCache());
  await targetCache.setFound(product.barcode, product, Date.now());
}
