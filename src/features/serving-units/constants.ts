export const VOLUME_UNIT_ML = {
  cl: 10,
  dl: 100,
  l: 1000,
  fl_oz: 29.5735,
  tbsp: 15,
  tsp: 5,
  glass: 240,
  cup: 240,
} as const;

export const NUTRIENT_BASIS_G = 100;

export const SERVING_UNITS = [
  'g',
  'kg',
  'oz',
  'ml',
  'cl',
  'dl',
  'l',
  'fl_oz',
  'unit',
  'pot',
  'serving',
  'tbsp',
  'tsp',
  'glass',
  'cup',
] as const;

export type ServingUnit = (typeof SERVING_UNITS)[number];
