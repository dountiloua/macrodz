export const VOLUME_UNIT_ML = {
  tbsp: 15,
  tsp: 5,
  glass: 240,
  cup: 240,
} as const;

export const DEFAULT_DENSITY_G_PER_ML = 1;

export const NUTRIENT_BASIS_G = 100;

export const SERVING_UNITS = ['g', 'ml', 'unit', 'pot', 'tbsp', 'tsp', 'glass', 'cup'] as const;

export type ServingUnit = (typeof SERVING_UNITS)[number];
