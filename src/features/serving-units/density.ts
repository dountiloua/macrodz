import type { ServingUnit } from './constants';

export const PRODUCT_DENSITIES_G_PER_ML = {
  'olive oil': 0.92,
  'vegetable oil': 0.92,
  honey: 1.4,
  milk: 1.03,
  water: 1,
} as const;

const SOLID_PRODUCT_TERMS = ['flour', 'couscous', 'farine', 'semoule'];
const VOLUME_UNITS: readonly ServingUnit[] = ['ml', 'tbsp', 'tsp', 'cup', 'glass'];

export function getProductDensityGPerMl(productName: string): number | undefined {
  const normalizedName = productName.trim().toLowerCase();
  const matchingProduct = (
    Object.keys(PRODUCT_DENSITIES_G_PER_ML) as (keyof typeof PRODUCT_DENSITIES_G_PER_ML)[]
  ).find((name) => normalizedName.includes(name));

  return matchingProduct === undefined ? undefined : PRODUCT_DENSITIES_G_PER_ML[matchingProduct];
}

export function isVolumeServingUnit(unit: ServingUnit): boolean {
  return VOLUME_UNITS.includes(unit);
}

export function isSolidWithoutDensity(productName: string, densityGPerMl?: number): boolean {
  if (densityGPerMl !== undefined) {
    return false;
  }

  const normalizedName = productName.trim().toLowerCase();
  return SOLID_PRODUCT_TERMS.some((term) => normalizedName.includes(term));
}
