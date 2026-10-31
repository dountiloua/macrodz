import { normalizeBarcode } from './barcode';
import type { ParsedProduct } from './types';
import type { ServingUnit } from '../serving-units/constants';

export function normalizeManualBarcode(input: string) {
  return normalizeBarcode(input);
}

export function buildManualProductForm(currentBarcode: string, existingProduct?: ParsedProduct) {
  const fallbackName = existingProduct
    ? `${existingProduct.brand ? `${existingProduct.brand} ` : ''}${existingProduct.barcode}`
    : '';

  return {
    barcode: currentBarcode,
    name: existingProduct && existingProduct.name !== fallbackName ? existingProduct.name : '',
    brand: existingProduct?.brand ?? '',
    kcal: existingProduct?.kcal ?? '',
    protein: existingProduct?.protein ?? '',
    carbs: existingProduct?.carbs ?? '',
    fat: existingProduct?.fat ?? '',
    servingQuantityG: existingProduct?.servingQuantityG ?? '',
  };
}

export function getInitialServingSelection(
  product: ParsedProduct,
  availableUnits: readonly ServingUnit[],
): { quantity: string; unit: ServingUnit } {
  if (product.servingQuantityG !== undefined && availableUnits.includes('unit')) {
    return { quantity: '1', unit: 'unit' };
  }

  return { quantity: '100', unit: 'g' };
}
