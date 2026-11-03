import { NUTRIENT_BASIS_G } from '../serving-units/constants';
import type { ProductKind } from '../serving-units/types';
import type { OpenFoodFactsRawProduct, ParseResult, ParsedProduct } from './types';

const KJ_PER_KCAL = 4.184;
const MAX_KCAL_PER_100G = 900;
const MAX_MACRO_SUM_PER_100G = 100;
const LIQUID_CATEGORY_TAGS = new Set([
  'en:beverages',
  'en:waters',
  'en:milks',
  'en:juices',
  'en:sodas',
  'en:plant-based-milks',
  'en:fermented-milks',
]);
export function classifyProductKind(
  quantityText: unknown,
  categoriesTags: unknown = [],
  productName: unknown = '',
): ProductKind {
  const tags = Array.isArray(categoriesTags)
    ? categoriesTags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim().toLowerCase())
    : [];
  const normalizedName = typeof productName === 'string' ? productName.toLowerCase() : '';
  const isOilOrHoney =
    tags.some((tag) => tag === 'en:honey' || /(?:^|-)oils?$/.test(tag)) ||
    /\b(?:oil|oils|huile|huiles|honey|miel)\b|زيت|عسل/u.test(normalizedName);

  if (isOilOrHoney) {
    return 'solid';
  }

  const quantity = typeof quantityText === 'string' ? quantityText : '';
  if (/(?:^|[^a-z])(?:ml|cl|dl|l|litres?|liters?|fl\s*oz)(?=$|[^a-z])/i.test(quantity)) {
    return 'liquid';
  }

  return tags.some((tag) => LIQUID_CATEGORY_TAGS.has(tag)) ? 'liquid' : 'solid';
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');

    if (normalized.length === 0) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readPositiveNumber(value: unknown): number | null {
  const parsed = readNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function readNutriment(
  nutriments: Record<string, unknown> | undefined,
  key: string,
): number | null {
  if (nutriments === undefined) {
    return null;
  }

  return readNumber(nutriments[key]);
}

export function parseServingSizeG(text: string): number | null {
  const parenthesized = text.match(/\(\s*(\d+(?:[.,]\d+)?)\s*(?:g|ml)\s*\)/i);
  const match = parenthesized ?? text.match(/(\d+(?:[.,]\d+)?)\s*(?:g|ml)\b/i);

  if (match === null) {
    return null;
  }

  return readPositiveNumber(match[1]);
}

function readServingQuantityG(raw: OpenFoodFactsRawProduct): number | null {
  const fromField = readPositiveNumber(raw.serving_quantity);

  if (fromField !== null) {
    return fromField;
  }

  const fromText =
    typeof raw.serving_size === 'string' ? parseServingSizeG(raw.serving_size) : null;
  return fromText;
}

function readCountriesTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readHttpsUrl(value: unknown): string | undefined {
  const url = readString(value);
  return url.startsWith('https://') ? url : undefined;
}

function per100FromServing(
  nutriments: Record<string, unknown> | undefined,
  perServingKey: string,
  servingQuantityG: number | null,
): number | null {
  const perServing = readNutriment(nutriments, perServingKey);

  if (perServing === null || servingQuantityG === null) {
    return null;
  }

  return (perServing / servingQuantityG) * NUTRIENT_BASIS_G;
}

function resolveNutrient(
  nutriments: Record<string, unknown> | undefined,
  per100Key: string,
  per100MlKey: string,
  perServingKey: string,
  servingQuantityG: number | null,
  kind: ProductKind,
): number | null {
  const per100 =
    kind === 'liquid'
      ? readNutriment(nutriments, per100MlKey)
      : readNutriment(nutriments, per100Key);

  if (per100 !== null) {
    return per100;
  }

  return per100FromServing(nutriments, perServingKey, servingQuantityG);
}

function resolveKcal(
  nutriments: Record<string, unknown> | undefined,
  servingQuantityG: number | null,
  kind: ProductKind,
): number | null {
  const kcal = readNutriment(
    nutriments,
    kind === 'liquid' ? 'energy-kcal_100ml' : 'energy-kcal_100g',
  );

  if (kcal !== null) {
    return kcal;
  }

  const kilojoules = readNutriment(
    nutriments,
    kind === 'liquid' ? 'energy_100ml' : 'energy_100g',
  );

  if (kilojoules !== null) {
    return kilojoules / KJ_PER_KCAL;
  }

  return per100FromServing(nutriments, 'energy-kcal_serving', servingQuantityG);
}

function resolveOptionalNutrient(
  nutriments: Record<string, unknown> | undefined,
  per100Key: string,
  per100MlKey: string,
  perServingKey: string,
  servingQuantityG: number | null,
  kind: ProductKind,
): number | undefined {
  const value = resolveNutrient(
    nutriments,
    per100Key,
    per100MlKey,
    perServingKey,
    servingQuantityG,
    kind,
  );
  return value !== null && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function parseOpenFoodFactsProduct(
  raw: OpenFoodFactsRawProduct,
  barcode: string,
): ParseResult {
  const nutriments = raw.nutriments;
  const servingQuantityG = readServingQuantityG(raw);
  const productName =
    [
      raw.product_name,
      raw.product_name_fr,
      raw.product_name_en,
      raw.product_name_ar,
      raw.generic_name,
    ]
      .map(readString)
      .find((candidate) => candidate.length > 0) ?? '';
  const kind = classifyProductKind(raw.quantity, raw.categories_tags, productName);

  const kcal = resolveKcal(nutriments, servingQuantityG, kind);
  const protein = resolveNutrient(
    nutriments,
    'proteins_100g',
    'proteins_100ml',
    'proteins_serving',
    servingQuantityG,
    kind,
  );
  const carbs = resolveNutrient(
    nutriments,
    'carbohydrates_100g',
    'carbohydrates_100ml',
    'carbohydrates_serving',
    servingQuantityG,
    kind,
  );
  const fat = resolveNutrient(
    nutriments,
    'fat_100g',
    'fat_100ml',
    'fat_serving',
    servingQuantityG,
    kind,
  );
  const sugars = resolveOptionalNutrient(
    nutriments,
    'sugars_100g',
    'sugars_100ml',
    'sugars_serving',
    servingQuantityG,
    kind,
  );
  const fiber = resolveOptionalNutrient(
    nutriments,
    'fiber_100g',
    'fiber_100ml',
    'fiber_serving',
    servingQuantityG,
    kind,
  );
  const saturatedFat = resolveOptionalNutrient(
    nutriments,
    'saturated-fat_100g',
    'saturated-fat_100ml',
    'saturated-fat_serving',
    servingQuantityG,
    kind,
  );
  const salt =
    resolveOptionalNutrient(
      nutriments,
      'salt_100g',
      'salt_100ml',
      'salt_serving',
      servingQuantityG,
      kind,
    ) ??
    (() => {
      const sodium = resolveOptionalNutrient(
        nutriments,
        'sodium_100g',
        'sodium_100ml',
        'sodium_serving',
        servingQuantityG,
        kind,
      );
      return sodium === undefined ? undefined : sodium * 2.5;
    })();
  const alcohol = resolveOptionalNutrient(
    nutriments,
    'alcohol_100g',
    'alcohol_100ml',
    'alcohol_serving',
    servingQuantityG,
    kind,
  );

  if (kcal === null || protein === null || carbs === null || fat === null) {
    return { ok: false, error: { code: 'INCOMPLETE_DATA' } };
  }

  if (![kcal, protein, carbs, fat].every(Number.isFinite)) {
    return { ok: false, error: { code: 'INVALID_DATA' } };
  }

  if (kcal < 0 || protein < 0 || carbs < 0 || fat < 0) {
    return { ok: false, error: { code: 'INVALID_DATA' } };
  }

  if (kcal > MAX_KCAL_PER_100G) {
    return { ok: false, error: { code: 'INVALID_DATA' } };
  }

  if (protein + carbs + fat > MAX_MACRO_SUM_PER_100G) {
    return { ok: false, error: { code: 'INVALID_DATA' } };
  }

  const countriesTags = readCountriesTags(raw.countries_tags);
  const brand = readString(raw.brands);
  const name = productName || `${brand ? `${brand} ` : ''}${barcode}`;
  const imageUrl = readHttpsUrl(raw.image_front_small_url) ?? readHttpsUrl(raw.image_front_url);
  const servingSize = readString(raw.serving_size);

  const product: ParsedProduct = {
    kind,
    barcode,
    name,
    ...(imageUrl ? { imageUrl } : {}),
    kcal,
    protein,
    carbs,
    fat,
    ...(sugars === undefined ? {} : { sugars }),
    ...(fiber === undefined ? {} : { fiber }),
    ...(saturatedFat === undefined ? {} : { saturatedFat }),
    ...(salt === undefined ? {} : { salt }),
    ...(alcohol === undefined ? {} : { alcohol }),
    servingQuantityG: servingQuantityG ?? undefined,
    brand: brand.length > 0 ? brand : undefined,
    servingSize: servingSize.length > 0 ? servingSize : undefined,
    countriesTags,
    isLikelyAlgerian:
      barcode.startsWith('613') || countriesTags.some((tag) => tag.toLowerCase() === 'en:algeria'),
  };

  return { ok: true, product };
}
