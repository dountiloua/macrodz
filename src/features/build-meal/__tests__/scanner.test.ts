import { describe, expect, it, jest } from '@jest/globals';

import type { LookupResult } from '@/features/food-lookup';

import { scanBuildMealProduct } from '../scanner';

const product = {
  kind: 'solid' as const,
  barcode: '0123456789012',
  name: 'Pasta',
  kcal: 350,
  protein: 12,
  carbs: 70,
  fat: 2,
  countriesTags: [],
  isLikelyAlgerian: false,
};

describe('scanBuildMealProduct', () => {
  it('uses the injected cached lookup and accepts usable nutrition', async () => {
    const lookup = jest.fn(async (_barcode: string): Promise<LookupResult> => ({
      ok: true,
      product,
      source: 'cache',
    }));

    await expect(scanBuildMealProduct(product.barcode, lookup)).resolves.toEqual({
      ok: true,
      product,
    });
    expect(lookup).toHaveBeenCalledWith(product.barcode);
  });

  it('returns a manual-entry outcome when the product has zero nutrition', async () => {
    const lookup = jest.fn(async (_barcode: string): Promise<LookupResult> => ({
      ok: true,
      product: { ...product, kind: 'liquid', kcal: 0, protein: 0, carbs: 0, fat: 0 },
      source: 'network',
    }));

    await expect(scanBuildMealProduct(product.barcode, lookup)).resolves.toMatchObject({
      ok: false,
      reason: 'nutrition-missing',
    });
  });

  it('preserves lookup failures without exposing their message', async () => {
    const lookup = jest.fn(async (_barcode: string): Promise<LookupResult> => ({
      ok: false,
      error: { code: 'NETWORK_ERROR' },
    }));

    await expect(scanBuildMealProduct(product.barcode, lookup)).resolves.toEqual({
      ok: false,
      reason: 'lookup-error',
      error: { code: 'NETWORK_ERROR' },
    });
  });
});
