import { NUTRIENT_BASIS_G } from '../serving-units/constants';
import type { OpenFoodFactsRawProduct, ParseResult, ParsedProduct } from './types';

const KJ_PER_KCAL = 4.184;
const MAX_KCAL_PER_100G = 900;
const MAX_MACRO_SUM_PER_100G = 100;

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

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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
  perServingKey: string,
  servingQuantityG: number | null,
): number | null {
  const per100 = readNutriment(nutriments, per100Key);

  if (per100 !== null) {
    return per100;
  }

  return per100FromServing(nutriments, perServingKey, servingQuantityG);
}

function resolveKcal(
  nutriments: Record<string, unknown> | undefined,
  servingQuantityG: number | null,
): number | null {
  const kcal = readNutriment(nutriments, 'energy-kcal_100g');

  if (kcal !== null) {
    return kcal;
  }

  const kilojoules = readNutriment(nutriments, 'energy_100g');

  if (kilojoules !== null) {
    return kilojoules / KJ_PER_KCAL;
  }

  return per100FromServing(nutriments, 'energy-kcal_serving', servingQuantityG);
}

export function parseOpenFoodFactsProduct(
  raw: OpenFoodFactsRawProduct,
  barcode: string,
): ParseResult {
  const nutriments = raw.nutriments;
  const servingQuantityG = readServingQuantityG(raw);

  const kcal = resolveKcal(nutriments, servingQuantityG);
  const protein = resolveNutrient(
    nutriments,
    'proteins_100g',
    'proteins_serving',
    servingQuantityG,
  );
  const carbs = resolveNutrient(
    nutriments,
    'carbohydrates_100g',
    'carbohydrates_serving',
    servingQuantityG,
  );
  const fat = resolveNutrient(nutriments, 'fat_100g', 'fat_serving', servingQuantityG);

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
  const name =
    [
      raw.product_name,
      raw.product_name_fr,
      raw.product_name_en,
      raw.product_name_ar,
      raw.generic_name,
    ]
      .map(readString)
      .find((candidate) => candidate.length > 0) ?? `${brand ? `${brand} ` : ''}${barcode}`;
  const imageUrl = readHttpsUrl(raw.image_front_small_url) ?? readHttpsUrl(raw.image_front_url);
  const servingSize = readString(raw.serving_size);

  const product: ParsedProduct = {
    barcode,
    name,
    ...(imageUrl ? { imageUrl } : {}),
    kcal: Math.round(kcal),
    protein: roundTo(protein, 1),
    carbs: roundTo(carbs, 1),
    fat: roundTo(fat, 1),
    servingQuantityG: servingQuantityG ?? undefined,
    brand: brand.length > 0 ? brand : undefined,
    servingSize: servingSize.length > 0 ? servingSize : undefined,
    countriesTags,
    isLikelyAlgerian:
      barcode.startsWith('613') || countriesTags.some((tag) => tag.toLowerCase() === 'en:algeria'),
  };

  return { ok: true, product };
}
