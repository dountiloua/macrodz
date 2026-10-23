import { describe, expect, it } from '@jest/globals';

import { createMemoryProductCache } from '../cache';
import {
  saveManualProduct,
  validateManualProduct,
  type ManualProductInput,
} from '../manual-product';

describe('validateManualProduct', () => {
  const validInput: ManualProductInput = {
    barcode: '6131234567890',
    name: 'Yaourt aux fruits Soummam',
    brand: 'Soummam',
    kcal: '85',
    protein: '3.2',
    carbs: '14.5',
    fat: '1.8',
    servingQuantityG: '125',
  };

  it('validates a correct manual product input', () => {
    const result = validateManualProduct(validInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.product).toEqual({
      barcode: '6131234567890',
      name: 'Yaourt aux fruits Soummam',
      brand: 'Soummam',
      kcal: 85,
      protein: 3.2,
      carbs: 14.5,
      fat: 1.8,
      servingQuantityG: 125,
      servingSize: '125 g',
      countriesTags: [],
      isLikelyAlgerian: true,
      source: 'user',
    });
  });

  it('accepts numbers with decimal commas and trims strings', () => {
    const result = validateManualProduct({
      ...validInput,
      protein: ' 3,5 ',
      carbs: ' 12,0 ',
      fat: ' 2,5 ',
      servingQuantityG: ' 125,5 ',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.product.protein).toBe(3.5);
    expect(result.product.carbs).toBe(12);
    expect(result.product.fat).toBe(2.5);
    expect(result.product.servingQuantityG).toBe(125.5);
  });

  it('detects non-Algerian barcodes', () => {
    const result = validateManualProduct({
      ...validInput,
      barcode: '3012345678901',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.product.isLikelyAlgerian).toBe(false);
  });

  it('allows optional brand and serving size to be omitted', () => {
    const result = validateManualProduct({
      barcode: '6131234567890',
      name: 'Lait demi-écrémé',
      kcal: 46,
      protein: 3.2,
      carbs: 4.8,
      fat: 1.6,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.product.brand).toBeUndefined();
    expect(result.product.servingQuantityG).toBeUndefined();
    expect(result.product.servingSize).toBeUndefined();
  });

  it('rejects empty or whitespace-only name', () => {
    const result = validateManualProduct({
      ...validInput,
      name: '   ',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBe('REQUIRED');
  });

  it('rejects missing or negative calories', () => {
    const emptyKcal = validateManualProduct({ ...validInput, kcal: '' });
    expect(emptyKcal.ok).toBe(false);
    if (!emptyKcal.ok) {
      expect(emptyKcal.errors.kcal).toBe('REQUIRED');
    }

    const negativeKcal = validateManualProduct({ ...validInput, kcal: -10 });
    expect(negativeKcal.ok).toBe(false);
    if (!negativeKcal.ok) {
      expect(negativeKcal.errors.kcal).toBe('INVALID_NUMBER');
    }
  });

  it('rejects calories exceeding 900 kcal per 100 g', () => {
    const result = validateManualProduct({ ...validInput, kcal: 901 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.kcal).toBe('EXCEEDS_MAX');
    }
  });

  it('rejects negative macros', () => {
    const result = validateManualProduct({
      ...validInput,
      protein: -1,
      carbs: -2,
      fat: -0.5,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.protein).toBe('INVALID_NUMBER');
      expect(result.errors.carbs).toBe('INVALID_NUMBER');
      expect(result.errors.fat).toBe('INVALID_NUMBER');
    }
  });

  it('rejects macros whose sum exceeds 100 g per 100 g', () => {
    const result = validateManualProduct({
      ...validInput,
      protein: 40,
      carbs: 40,
      fat: 30, // 40 + 40 + 30 = 110 > 100
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.macrosSum).toBe('MACROS_EXCEED_100');
    }
  });

  it('accepts macros whose sum is exactly 100 g', () => {
    const result = validateManualProduct({
      ...validInput,
      protein: 20,
      carbs: 50,
      fat: 30, // 20 + 50 + 30 = 100
    });

    expect(result.ok).toBe(true);
  });

  it('rejects invalid or non-positive serving quantity', () => {
    const zeroServing = validateManualProduct({ ...validInput, servingQuantityG: '0' });
    expect(zeroServing.ok).toBe(false);
    if (!zeroServing.ok) {
      expect(zeroServing.errors.servingQuantityG).toBe('INVALID_NUMBER');
    }

    const negativeServing = validateManualProduct({ ...validInput, servingQuantityG: '-50' });
    expect(negativeServing.ok).toBe(false);
    if (!negativeServing.ok) {
      expect(negativeServing.errors.servingQuantityG).toBe('INVALID_NUMBER');
    }
  });
});

describe('saveManualProduct', () => {
  it('saves the product to cache with status found', async () => {
    const cache = createMemoryProductCache();
    const validation = validateManualProduct({
      barcode: '6131234567890',
      name: 'Fromage Berbère',
      kcal: 260,
      protein: 14,
      carbs: 2,
      fat: 22,
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    await saveManualProduct(validation.product, cache);

    const cached = await cache.get('6131234567890');
    expect(cached).not.toBeNull();
    expect(cached?.status).toBe('found');
    if (cached?.status === 'found') {
      expect(cached.product.name).toBe('Fromage Berbère');
      expect(cached.product.source).toBe('user');
    }
  });
});
