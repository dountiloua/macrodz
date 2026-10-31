import { describe, expect, it } from '@jest/globals';

import {
  buildManualProductForm,
  getInitialServingSelection,
  normalizeManualBarcode,
} from '../scan-handlers';
import type { ParsedProduct } from '../types';

const product: ParsedProduct = {
  barcode: '0123456789012',
  name: 'Olive oil',
  kcal: 884,
  protein: 0,
  carbs: 0,
  fat: 100,
  countriesTags: [],
  isLikelyAlgerian: false,
};

describe('scan handlers', () => {
  it('normalizes manual barcodes and returns normalization errors', () => {
    expect(normalizeManualBarcode(' 123456789012 ')).toEqual({
      ok: true,
      barcode: '0123456789012',
    });
    expect(normalizeManualBarcode('12A')).toEqual({
      ok: false,
      error: { code: 'INVALID_BARCODE' },
    });
  });

  it('builds the manual product form from an existing product', () => {
    expect(buildManualProductForm('other', product)).toEqual({
      barcode: 'other',
      name: 'Olive oil',
      brand: '',
      kcal: 884,
      protein: 0,
      carbs: 0,
      fat: 100,
      servingQuantityG: '',
    });
  });

  it('uses the single-unit amount only when that unit is available', () => {
    expect(getInitialServingSelection(product, ['g', 'ml'])).toEqual({
      quantity: '100',
      unit: 'g',
    });
    expect(getInitialServingSelection({ ...product, servingQuantityG: 30 }, ['g', 'unit'])).toEqual(
      { quantity: '1', unit: 'unit' },
    );
  });
});
