import { getProductDensityGPerMl } from './density';
import {
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

export function getVolumeUnitMl(unit: ServingUnit): number | undefined {
  if (unit === 'ml') return 1;
  if (
    unit === 'cl' ||
    unit === 'dl' ||
    unit === 'l' ||
    unit === 'fl_oz' ||
    unit === 'cup' ||
    unit === 'tbsp' ||
    unit === 'tsp' ||
    unit === 'glass'
  ) {
    return VOLUME_UNIT_ML[unit];
  }
  return undefined;
}

function isValidProduct(product: ServingProduct): boolean {
  return (
    isNonNegativeFinite(product.kcal) &&
    isNonNegativeFinite(product.protein) &&
    isNonNegativeFinite(product.carbs) &&
    isNonNegativeFinite(product.fat) &&
    [product.sugars, product.fiber, product.saturatedFat, product.salt].every(
      (value) => value === undefined || isNonNegativeFinite(value),
    ) &&
    (product.alcohol === undefined || isNonNegativeFinite(product.alcohol))
  );
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

  if (
    (product.kind === 'liquid' &&
      !(['ml', 'cl', 'dl', 'l', 'fl_oz', 'cup', 'tbsp', 'tsp', 'glass'] as string[]).includes(
        unit,
      )) ||
    (product.kind !== 'liquid' &&
      (unit === 'cl' || unit === 'dl' || unit === 'l' || unit === 'fl_oz'))
  ) {
    return { ok: false, error: 'UNIT_NOT_AVAILABLE' };
  }

  let grams: number;

  if (product.kind === 'liquid') {
    const millilitersPerUnit = getVolumeUnitMl(unit);
    if (millilitersPerUnit === undefined) {
      return { ok: false, error: 'UNIT_NOT_AVAILABLE' };
    }
    grams = quantity * millilitersPerUnit;
  } else if (unit === 'g') {
    grams = quantity;
  } else if (unit === 'kg') {
    grams = quantity * 1000;
  } else if (unit === 'oz') {
    grams = quantity * 28.349523125;
  } else if (unit === 'unit' || unit === 'pot') {
    if (unit === 'pot' && product.servingQuantityG === undefined) {
      return { ok: false, error: 'UNIT_NOT_AVAILABLE' };
    }

    if (product.servingQuantityG === undefined) {
      return { ok: false, error: 'UNIT_NOT_AVAILABLE' };
    }

    if (!Number.isFinite(product.servingQuantityG) || product.servingQuantityG <= 0) {
      return { ok: false, error: 'INVALID_PRODUCT' };
    }

    grams = quantity * product.servingQuantityG;
  } else if (unit === 'serving') {
    if (product.servingQuantityG === undefined) {
      return { ok: false, error: 'UNIT_NOT_AVAILABLE' };
    }
    grams = quantity * product.servingQuantityG;
  } else {
    const density =
      product.densityGPerMl ?? getProductDensityGPerMl(product.name ?? '');

    if (density === undefined || !Number.isFinite(density) || density <= 0) {
      return { ok: false, error: 'INVALID_PRODUCT' };
    }

    const millilitersPerUnit = getVolumeUnitMl(unit);
    if (millilitersPerUnit === undefined) {
      return { ok: false, error: 'UNIT_NOT_AVAILABLE' };
    }
    const milliliters = quantity * millilitersPerUnit;
    grams = milliliters * density;
  }

  const factor = grams / NUTRIENT_BASIS_G;
  const kcal = product.kcal * factor;
  const protein = product.protein * factor;
  const carbs = product.carbs * factor;
  const fat = product.fat * factor;
  const sugars = product.sugars === undefined ? undefined : product.sugars * factor;
  const fiber = product.fiber === undefined ? undefined : product.fiber * factor;
  const saturatedFat =
    product.saturatedFat === undefined ? undefined : product.saturatedFat * factor;
  const salt = product.salt === undefined ? undefined : product.salt * factor;
  const alcohol = product.alcohol === undefined ? undefined : product.alcohol * factor;

  if (
    ![grams, kcal, protein, carbs, fat, sugars, fiber, saturatedFat, salt, alcohol]
      .filter((value): value is number => value !== undefined)
      .every(Number.isFinite)
  ) {
    return { ok: false, error: 'INVALID_PRODUCT' };
  }

  return {
    ok: true,
    grams,
    kcal,
    protein,
    carbs,
    fat,
    ...(sugars === undefined ? {} : { sugars }),
    ...(fiber === undefined ? {} : { fiber }),
    ...(saturatedFat === undefined ? {} : { saturatedFat }),
    ...(salt === undefined ? {} : { salt }),
    ...(alcohol === undefined ? {} : { alcohol }),
  };
}

export function getAvailableServingUnits(product: ServingProduct, productName = ''): ServingUnit[] {
  if (product.kind === 'liquid') {
    return ['ml', 'cl', 'dl', 'l', 'fl_oz', 'cup', 'tbsp', 'tsp', 'glass'];
  }

  const hasServingQuantity =
    product.servingQuantityG !== undefined &&
    Number.isFinite(product.servingQuantityG) &&
    product.servingQuantityG > 0;
  const density = product.densityGPerMl ?? getProductDensityGPerMl(productName);
  const volumeUnitsAllowed =
    density !== undefined && Number.isFinite(density) && density > 0;

  return SERVING_UNITS.filter((unit) => {
    if (unit === 'unit') {
      return hasServingQuantity;
    }
    if (unit === 'pot' || unit === 'serving') {
      return false;
    }
    if (
      unit === 'ml' ||
      unit === 'tbsp' ||
      unit === 'tsp' ||
      unit === 'glass' ||
      unit === 'cup'
    ) {
      return volumeUnitsAllowed;
    }
    return unit !== 'cl' && unit !== 'dl' && unit !== 'l' && unit !== 'fl_oz';
  });
}

export function getCalculatorUnits(product: ServingProduct): ServingUnit[] {
  if (product.kind === 'liquid') {
    return ['ml', 'cl', 'dl', 'l'];
  }
  return product.servingQuantityG === undefined ? ['g', 'kg', 'oz'] : ['g', 'kg', 'oz', 'unit'];
}

export function getEquivalentUnits(
  product: ServingProduct,
  productName = product.name ?? '',
): ServingUnit[] {
  if (product.kind === 'liquid') {
    return ['ml', 'cl', 'dl', 'l', 'fl_oz', 'cup', 'tbsp', 'tsp', 'glass'];
  }
  const density = product.densityGPerMl ?? getProductDensityGPerMl(productName);
  const volumeUnitsAllowed = density !== undefined && Number.isFinite(density) && density > 0;
  return [
    'g',
    'kg',
    'oz',
    ...(product.servingQuantityG === undefined ? [] : (['unit'] as const)),
    ...(volumeUnitsAllowed ? (['ml', 'cup', 'tbsp', 'tsp'] as const) : []),
  ];
}

export function getEquivalentAmounts(
  product: ServingProduct,
  quantity: number,
  unit: ServingUnit,
  productName = product.name ?? '',
): { unit: ServingUnit; quantity: number }[] {
  const resolvedProduct: ServingProduct = {
    ...product,
    name: productName,
    ...(product.densityGPerMl === undefined && getProductDensityGPerMl(productName) !== undefined
      ? { densityGPerMl: getProductDensityGPerMl(productName) }
      : {}),
  };
  const converted = convertServing(resolvedProduct, quantity, unit);
  if (!converted.ok) return [];

  const baseUnit: ServingUnit = product.kind === 'liquid' ? 'ml' : 'g';
  const baseAmount = converted.grams;
  const units = getEquivalentUnits(resolvedProduct, productName);

  return units.map((equivalentUnit) => {
    if (equivalentUnit === baseUnit) {
      return { unit: equivalentUnit, quantity: baseAmount };
    }
    if (equivalentUnit === 'kg') {
      return { unit: equivalentUnit, quantity: baseAmount / 1000 };
    }
    if (equivalentUnit === 'oz') {
      return { unit: equivalentUnit, quantity: baseAmount / 28.349523125 };
    }
    if (equivalentUnit === 'unit') {
      return {
        unit: equivalentUnit,
        quantity: baseAmount / (product.servingQuantityG ?? 1),
      };
    }
    if (product.kind === 'liquid') {
      const millilitersPerUnit = getVolumeUnitMl(equivalentUnit);
      return {
        unit: equivalentUnit,
        quantity: millilitersPerUnit === undefined ? Number.NaN : baseAmount / millilitersPerUnit,
      };
    }

    const density = resolvedProduct.densityGPerMl ?? getProductDensityGPerMl(productName);
    const milliliters = density === undefined ? 0 : baseAmount / density;
    const millilitersPerUnit = getVolumeUnitMl(equivalentUnit);
    return {
      unit: equivalentUnit,
      quantity: millilitersPerUnit === undefined ? Number.NaN : milliliters / millilitersPerUnit,
    };
  });
}
