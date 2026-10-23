import {
  DEFAULT_DENSITY_G_PER_ML,
  NUTRIENT_BASIS_G,
  SERVING_UNITS,
  VOLUME_UNIT_ML,
  type ServingUnit,
} from './constants';
import type { ServingConversionResult, ServingProduct } from './types';

function isServingUnit(value: string): value is ServingUnit {
  return (SERVING_UNITS as readonly string[]).includes(value);
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isValidProduct(product: ServingProduct): boolean {
  return (
    isNonNegativeFinite(product.kcal) &&
    isNonNegativeFinite(product.protein) &&
    isNonNegativeFinite(product.carbs) &&
    isNonNegativeFinite(product.fat)
  );
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function convertServing(
  product: ServingProduct,
  quantity: number,
  unit: ServingUnit,
): ServingConversionResult {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: 'QUANTITY_INVALID' };
  }

  if (!isServingUnit(unit)) {
    return { ok: false, error: 'INVALID_UNIT' };
  }

  if (!isValidProduct(product)) {
    return { ok: false, error: 'INVALID_PRODUCT' };
  }

  let grams: number;

  if (unit === 'g') {
    grams = quantity;
  } else if (unit === 'unit' || unit === 'pot') {
    if (product.servingQuantityG === undefined) {
      return { ok: false, error: 'UNIT_NOT_AVAILABLE' };
    }

    if (!Number.isFinite(product.servingQuantityG) || product.servingQuantityG <= 0) {
      return { ok: false, error: 'INVALID_PRODUCT' };
    }

    grams = quantity * product.servingQuantityG;
  } else {
    const density = product.densityGPerMl ?? DEFAULT_DENSITY_G_PER_ML;

    if (!Number.isFinite(density) || density <= 0) {
      return { ok: false, error: 'INVALID_PRODUCT' };
    }

    const milliliters = unit === 'ml' ? quantity : quantity * VOLUME_UNIT_ML[unit];
    grams = milliliters * density;
  }

  grams = roundTo(grams, 1);

  const factor = grams / NUTRIENT_BASIS_G;
  const kcal = Math.round(product.kcal * factor);
  const protein = roundTo(product.protein * factor, 1);
  const carbs = roundTo(product.carbs * factor, 1);
  const fat = roundTo(product.fat * factor, 1);

  if (![grams, kcal, protein, carbs, fat].every(Number.isFinite)) {
    return { ok: false, error: 'INVALID_PRODUCT' };
  }

  return { ok: true, grams, kcal, protein, carbs, fat };
}

export function getAvailableServingUnits(product: ServingProduct): ServingUnit[] {
  const hasServingQuantity =
    product.servingQuantityG !== undefined &&
    Number.isFinite(product.servingQuantityG) &&
    product.servingQuantityG > 0;

  return SERVING_UNITS.filter((unit) => {
    if (unit === 'unit' || unit === 'pot') {
      return hasServingQuantity;
    }
    return true;
  });
}
