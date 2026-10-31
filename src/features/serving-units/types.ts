import type { ServingUnit } from './constants';

export type ProductKind = 'liquid' | 'solid';

export type ServingProduct = {
  kind?: ProductKind;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  servingQuantityG?: number;
  densityGPerMl?: number;
};

export type ServingConversionErrorCode =
  'QUANTITY_INVALID' | 'UNIT_NOT_AVAILABLE' | 'INVALID_PRODUCT' | 'INVALID_UNIT';

export type ServingConversionSuccess = {
  ok: true;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type ServingConversionFailure = {
  ok: false;
  error: ServingConversionErrorCode;
};

export type ServingConversionResult = ServingConversionSuccess | ServingConversionFailure;

export type ServingConversionInput = {
  product: ServingProduct;
  quantity: number;
  unit: ServingUnit;
};
