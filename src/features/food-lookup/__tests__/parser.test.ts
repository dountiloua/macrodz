import { describe, expect, it } from '@jest/globals';

import { parseOpenFoodFactsProduct, parseServingSizeG } from '../parser';
import type { OpenFoodFactsRawProduct, ParsedProduct } from '../types';

const ALGERIAN_BARCODE = '6131234567890';

const normalRaw: OpenFoodFactsRawProduct = {
  product_name: 'Yaourt nature',
  brands: 'Danone',
  serving_size: '125 g',
  serving_quantity: 125,
  countries_tags: ['en:algeria', 'en:france'],
  nutriments: {
    'energy-kcal_100g': 64,
    proteins_100g: 3.4,
    carbohydrates_100g: 4.8,
    fat_100g: 3.6,
  },
};

function expectProduct(raw: OpenFoodFactsRawProduct, barcode = ALGERIAN_BARCODE): ParsedProduct {
  const result = parseOpenFoodFactsProduct(raw, barcode);

  if (!result.ok) {
    throw new Error(`Expected a parsed product but got ${result.error.code}`);
  }

  return result.product;
}

describe('parseServingSizeG', () => {
  it('parses grams', () => {
    expect(parseServingSizeG('125 g')).toBe(125);
    expect(parseServingSizeG('125g')).toBe(125);
  });

  it('parses the grams inside a pot label', () => {
    expect(parseServingSizeG('1 pot (125g)')).toBe(125);
  });

  it('parses milliliters and decimal commas', () => {
    expect(parseServingSizeG('240 ml')).toBe(240);
    expect(parseServingSizeG('1,5 L')).toBeNull();
    expect(parseServingSizeG('12,5 g')).toBe(12.5);
  });

  it('returns null when no size is present', () => {
    expect(parseServingSizeG('1 pot')).toBeNull();
    expect(parseServingSizeG('')).toBeNull();
  });
});

describe('parseOpenFoodFactsProduct', () => {
  it('parses a normal per-100g product', () => {
    expect(expectProduct(normalRaw)).toEqual({
      barcode: ALGERIAN_BARCODE,
      name: 'Yaourt nature',
      brand: 'Danone',
      servingSize: '125 g',
      servingQuantityG: 125,
      kcal: 64,
      protein: 3.4,
      carbs: 4.8,
      fat: 3.6,
      countriesTags: ['en:algeria', 'en:france'],
      isLikelyAlgerian: true,
    });
  });

  it('resolves the product name using the documented fallback order', () => {
    expect(
      expectProduct({
        product_name: 'Primary name',
        product_name_fr: 'Nom français',
        generic_name: 'Generic name',
        nutriments: normalRaw.nutriments,
      }).name,
    ).toBe('Primary name');
    expect(
      expectProduct({
        product_name_fr: 'Nom français',
        product_name_en: 'English name',
        product_name_ar: 'اسم عربي',
        generic_name: 'Generic name',
        nutriments: normalRaw.nutriments,
      }).name,
    ).toBe('Nom français');
    expect(
      expectProduct({
        product_name_en: 'English name',
        product_name_ar: 'اسم عربي',
        generic_name: 'Generic name',
        nutriments: normalRaw.nutriments,
      }).name,
    ).toBe('English name');
    expect(
      expectProduct({
        product_name_ar: 'اسم عربي',
        generic_name: 'Generic name',
        nutriments: normalRaw.nutriments,
      }).name,
    ).toBe('اسم عربي');
    expect(
      expectProduct({ generic_name: 'Generic name', nutriments: normalRaw.nutriments }).name,
    ).toBe('Generic name');
  });

  it('uses a French product name when no other name is available', () => {
    expect(
      expectProduct({
        product_name_fr: 'Yaourt nature',
        nutriments: normalRaw.nutriments,
      }).name,
    ).toBe('Yaourt nature');
  });

  it('uses an HTTPS image URL and falls back to the full-size image', () => {
    expect(
      expectProduct({
        image_front_small_url: 'https://images.example/small.jpg',
        image_front_url: 'https://images.example/front.jpg',
        nutriments: normalRaw.nutriments,
      }).imageUrl,
    ).toBe('https://images.example/small.jpg');
    expect(
      expectProduct({
        image_front_small_url: 'http://images.example/small.jpg',
        image_front_url: 'https://images.example/front.jpg',
        nutriments: normalRaw.nutriments,
      }).imageUrl,
    ).toBe('https://images.example/front.jpg');
    expect(
      expectProduct({
        image_front_small_url: 'http://images.example/small.jpg',
        image_front_url: 'http://images.example/front.jpg',
        nutriments: normalRaw.nutriments,
      }).imageUrl,
    ).toBeUndefined();
  });

  it('uses brand and barcode when the product has no name or image', () => {
    const product = expectProduct({
      brands: 'Danone',
      nutriments: normalRaw.nutriments,
    });

    expect(product.name).toBe(`Danone ${ALGERIAN_BARCODE}`);
    expect(product.imageUrl).toBeUndefined();
  });

  it('converts kJ to kcal when kcal is missing', () => {
    const product = expectProduct({
      nutriments: {
        energy_100g: 1000,
        proteins_100g: 5,
        carbohydrates_100g: 10,
        fat_100g: 2,
      },
    });

    expect(product.kcal).toBe(239);
  });

  it('converts per-serving values to per-100g', () => {
    const product = expectProduct({
      serving_size: '125 g',
      serving_quantity: 125,
      nutriments: {
        'energy-kcal_serving': 100,
        proteins_serving: 5,
        carbohydrates_serving: 10,
        fat_serving: 2.5,
      },
    });

    expect(product).toMatchObject({ kcal: 80, protein: 4, carbs: 8, fat: 2 });
  });

  it('uses serving_size text when serving_quantity is missing', () => {
    const product = expectProduct({
      serving_size: '1 pot (125g)',
      nutriments: {
        'energy-kcal_serving': 100,
        proteins_serving: 5,
        carbohydrates_serving: 10,
        fat_serving: 2.5,
      },
    });

    expect(product.servingQuantityG).toBe(125);
    expect(product.kcal).toBe(80);
  });

  it('treats a missing macro as incomplete data', () => {
    const raw: OpenFoodFactsRawProduct = {
      nutriments: {
        'energy-kcal_100g': 64,
        proteins_100g: 3.4,
        carbohydrates_100g: 4.8,
      },
    };

    expect(parseOpenFoodFactsProduct(raw, ALGERIAN_BARCODE)).toEqual({
      ok: false,
      error: { code: 'INCOMPLETE_DATA' },
    });
  });

  it('treats missing energy as incomplete data', () => {
    const raw: OpenFoodFactsRawProduct = {
      nutriments: {
        proteins_100g: 3.4,
        carbohydrates_100g: 4.8,
        fat_100g: 3.6,
      },
    };

    expect(parseOpenFoodFactsProduct(raw, ALGERIAN_BARCODE)).toEqual({
      ok: false,
      error: { code: 'INCOMPLETE_DATA' },
    });
  });

  it('requires serving_quantity for per-serving-only data', () => {
    const raw: OpenFoodFactsRawProduct = {
      nutriments: {
        'energy-kcal_serving': 100,
        proteins_serving: 5,
        carbohydrates_serving: 10,
        fat_serving: 2.5,
      },
    };

    expect(parseOpenFoodFactsProduct(raw, ALGERIAN_BARCODE)).toEqual({
      ok: false,
      error: { code: 'INCOMPLETE_DATA' },
    });
  });

  it('rejects impossible macros', () => {
    const raw: OpenFoodFactsRawProduct = {
      nutriments: {
        'energy-kcal_100g': 400,
        proteins_100g: 40,
        carbohydrates_100g: 40,
        fat_100g: 30,
      },
    };

    expect(parseOpenFoodFactsProduct(raw, ALGERIAN_BARCODE)).toEqual({
      ok: false,
      error: { code: 'INVALID_DATA' },
    });
  });

  it('rejects negative values and more than 900 kcal', () => {
    expect(
      parseOpenFoodFactsProduct(
        {
          nutriments: {
            'energy-kcal_100g': 64,
            proteins_100g: -1,
            carbohydrates_100g: 4.8,
            fat_100g: 3.6,
          },
        },
        ALGERIAN_BARCODE,
      ),
    ).toEqual({ ok: false, error: { code: 'INVALID_DATA' } });

    expect(
      parseOpenFoodFactsProduct(
        {
          nutriments: {
            'energy-kcal_100g': 901,
            proteins_100g: 1,
            carbohydrates_100g: 1,
            fat_100g: 1,
          },
        },
        ALGERIAN_BARCODE,
      ),
    ).toEqual({ ok: false, error: { code: 'INVALID_DATA' } });
  });

  it('accepts macros that add up to exactly 100 g', () => {
    const product = expectProduct({
      nutriments: {
        'energy-kcal_100g': 400,
        proteins_100g: 20,
        carbohydrates_100g: 50,
        fat_100g: 30,
      },
    });

    expect(product.protein + product.carbs + product.fat).toBe(100);
  });

  it('stores countries_tags and detects Algerian products', () => {
    const byTag = expectProduct(
      {
        product_name: 'Produit',
        brands: 'Marque',
        countries_tags: ['en:france', 'en:algeria'],
        nutriments: {
          'energy-kcal_100g': 100,
          proteins_100g: 1,
          carbohydrates_100g: 1,
          fat_100g: 1,
        },
      },
      '3012345678901',
    );
    const byBarcode = expectProduct(normalRaw, '6130000000000');
    const neither = expectProduct(
      {
        countries_tags: ['en:france'],
        nutriments: {
          'energy-kcal_100g': 100,
          proteins_100g: 1,
          carbohydrates_100g: 1,
          fat_100g: 1,
        },
      },
      '3012345678901',
    );

    expect(byTag.countriesTags).toEqual(['en:france', 'en:algeria']);
    expect(byTag.isLikelyAlgerian).toBe(true);
    expect(byBarcode.isLikelyAlgerian).toBe(true);
    expect(neither.isLikelyAlgerian).toBe(false);
  });
});
