import { describe, expect, it } from '@jest/globals';

import { SERVING_UNITS, type ServingUnit } from '../constants';
import {
  convertServing,
  getAvailableServingUnits,
  getCalculatorUnits,
  getEquivalentAmounts,
  getEquivalentUnits,
} from '../convert';
import { getProductDensityGPerMl, PRODUCT_DENSITIES_G_PER_ML } from '../density';
import type { ServingConversionResult, ServingConversionSuccess, ServingProduct } from '../types';

const milk: ServingProduct = {
  kcal: 64,
  protein: 3.4,
  carbs: 4.8,
  fat: 3.6,
  densityGPerMl: 1.03,
};

const liquid: ServingProduct = {
  kind: 'liquid',
  kcal: 64,
  protein: 3.4,
  carbs: 4.8,
  fat: 3.6,
  densityGPerMl: 1.03,
};

const oil: ServingProduct = {
  kcal: 884,
  protein: 0,
  carbs: 0,
  fat: 100,
  densityGPerMl: 0.92,
};

const yogurtPot: ServingProduct = {
  kcal: 60,
  protein: 3.5,
  carbs: 7,
  fat: 1.5,
  servingQuantityG: 125,
};

function expectSuccess(result: ServingConversionResult): ServingConversionSuccess {
  if (!result.ok) {
    throw new Error(`Expected a successful conversion but got ${result.error}`);
  }

  return result;
}

describe('convertServing', () => {
  it('defines expected densities for common foods', () => {
    expect(PRODUCT_DENSITIES_G_PER_ML).toEqual({
      'olive oil': 0.92,
      'vegetable oil': 0.92,
      honey: 1.4,
      milk: 1.03,
      water: 1,
    });
    expect(getProductDensityGPerMl("Huile d'olive")).toBe(0.92);
    expect(getProductDensityGPerMl('Miel')).toBe(1.4);
  });

  describe('mass and volume conversions', () => {
    it('converts volume units to millilitres without applying density for liquids', () => {
      const centiliters = expectSuccess(convertServing(liquid, 1, 'cl'));
      expect(centiliters.grams).toBe(10);
      expect(centiliters.kcal).toBeCloseTo(6.4);
      expect(centiliters.protein).toBeCloseTo(0.34);
      expect(centiliters.carbs).toBeCloseTo(0.48);
      expect(centiliters.fat).toBeCloseTo(0.36);
      expect(expectSuccess(convertServing(liquid, 1, 'l')).grams).toBe(1000);
      expect(expectSuccess(convertServing(liquid, 1, 'dl')).grams).toBe(100);
      expect(expectSuccess(convertServing(liquid, 1, 'fl_oz')).grams).toBeCloseTo(29.5735);
    });

    it('rejects units unavailable for each product kind', () => {
      for (const unit of [
        'g',
        'kg',
        'oz',
        'unit',
        'pot',
        'serving',
      ] as const) {
        expect(convertServing(liquid, 100, unit)).toEqual({
          ok: false,
          error: 'UNIT_NOT_AVAILABLE',
        });
      }
      for (const unit of ['cl', 'dl', 'l', 'fl_oz'] as const) {
        expect(convertServing({ ...milk, kind: 'solid' }, 1, unit)).toEqual({
          ok: false,
          error: 'UNIT_NOT_AVAILABLE',
        });
      }
    });

    it('converts grams directly without using density', () => {
      const result = expectSuccess(convertServing(milk, 150, 'g'));
      expect(result.grams).toBe(150);
      expect(result.kcal).toBe(96);
      expect(result.protein).toBeCloseTo(5.1);
      expect(result.carbs).toBeCloseTo(7.2);
      expect(result.fat).toBeCloseTo(5.4);
    });

    it('uses density for milliliters', () => {
      const result = expectSuccess(convertServing(oil, 100, 'ml'));

      expect(result.grams).toBe(92);
      expect(result.kcal).toBeCloseTo(813.28);
      expect(result.fat).toBe(92);
    });

    it('does not assume a density for a solid with unknown density', () => {
      const water: ServingProduct = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
      expect(convertServing(water, 250, 'ml')).toEqual({
        ok: false,
        error: 'INVALID_PRODUCT',
      });
    });

    it('applies the configured tablespoon, teaspoon, glass and cup sizes', () => {
      const tablespoon = expectSuccess(convertServing(oil, 1, 'tbsp'));
      const teaspoons = expectSuccess(convertServing(oil, 3, 'tsp'));
      const cup = expectSuccess(convertServing(milk, 1, 'cup'));
      const glass = expectSuccess(convertServing(milk, 1, 'glass'));

      expect(tablespoon.grams).toBe(13.8);
      expect(teaspoons.grams).toBe(13.8);
      expect(cup).toEqual(glass);
      expect(cup.grams).toBeCloseTo(247.2);
      expect(tablespoon.kcal).toBeCloseTo(121.992);
    });
  });

  describe('hand-checked examples', () => {
    it('matches hand-calculated liquid calorie totals in every requested volume unit', () => {
      const juice: ServingProduct = {
        kind: 'liquid',
        kcal: 42,
        protein: 0,
        carbs: 0,
        fat: 0,
      };

      expect(expectSuccess(convertServing(juice, 250, 'ml')).kcal).toBe(105);
      expect(expectSuccess(convertServing(juice, 1.5, 'dl')).kcal).toBe(63);
      expect(expectSuccess(convertServing(juice, 2, 'cup')).kcal).toBeCloseTo(201.6);
      expect(expectSuccess(convertServing(juice, 0.33, 'l')).kcal).toBeCloseTo(138.6);
    });

    it('matches hand-calculated solid calorie totals in g and kg', () => {
      const product: ServingProduct = {
        kind: 'solid',
        kcal: 520,
        protein: 0,
        carbs: 0,
        fat: 0,
      };

      expect(expectSuccess(convertServing(product, 37, 'g')).kcal).toBe(192.4);
      expect(expectSuccess(convertServing(product, 0.5, 'kg')).kcal).toBe(2600);
    });

    it('round-trips each equivalent amount without changing the base quantity', () => {
      const liquidProduct: ServingProduct = {
        ...liquid,
        kcal: 42,
        protein: 0,
        carbs: 0,
        fat: 0,
      };
      const solidProduct: ServingProduct = {
        ...oil,
        name: 'Olive oil',
        kind: 'solid',
        servingQuantityG: 13,
      };

      for (const [product, baseUnit, baseAmount] of [
        [liquidProduct, 'ml', 123.45],
        [solidProduct, 'g', 30],
      ] as const) {
        const equivalents = getEquivalentAmounts(product, baseAmount, baseUnit);
        expect(equivalents.map((entry) => entry.unit)).toEqual(
          getEquivalentUnits(product),
        );
        for (const equivalent of equivalents) {
          expect(
            expectSuccess(convertServing(product, equivalent.quantity, equivalent.unit)).grams,
          ).toBeCloseTo(baseAmount, 8);

          const reverseEquivalents = getEquivalentAmounts(
            product,
            equivalent.quantity,
            equivalent.unit,
          );
          expect(reverseEquivalents.map((entry) => entry.unit)).toEqual(
            getEquivalentUnits(product),
          );
          for (const reverse of reverseEquivalents) {
            expect(
              expectSuccess(convertServing(product, reverse.quantity, reverse.unit)).grams,
            ).toBeCloseTo(baseAmount, 8);
          }
        }
      }
    });

    it('offers the calculator units required for each product kind', () => {
      expect(getCalculatorUnits(liquid)).toEqual(['ml', 'cl', 'dl', 'l']);
      expect(getCalculatorUnits(yogurtPot)).toEqual(['g', 'kg', 'oz', 'unit']);
    });

    it('converts 2 glasses of milk', () => {
      const result = expectSuccess(convertServing(milk, 2, 'glass'));
      expect(result.grams).toBeCloseTo(494.4);
      expect(result.kcal).toBeCloseTo(316.416);
      expect(result.protein).toBeCloseTo(16.8096);
      expect(result.carbs).toBeCloseTo(23.7312);
      expect(result.fat).toBeCloseTo(17.7984);
    });

    it('converts 1 tablespoon of oil', () => {
      expect(expectSuccess(convertServing(oil, 1, 'tbsp'))).toEqual({
        ok: true,
        grams: 13.8,
        kcal: 121.992,
        protein: 0,
        carbs: 0,
        fat: 13.8,
      });
    });

    it('converts a yogurt pot with a 125 g serving size', () => {
      expect(expectSuccess(convertServing(yogurtPot, 1, 'pot'))).toEqual({
        ok: true,
        grams: 125,
        kcal: 75,
        protein: 4.375,
        carbs: 8.75,
        fat: 1.875,
      });
    });
  });

  describe('unit and pot', () => {
    it('uses servingQuantityG for both unit and pot', () => {
      const oneUnit = expectSuccess(convertServing(yogurtPot, 1, 'unit'));
      const twoUnits = expectSuccess(convertServing(yogurtPot, 2, 'unit'));
      const halfPot = expectSuccess(convertServing(yogurtPot, 0.5, 'pot'));

      expect(oneUnit.grams).toBe(125);
      expect(twoUnits.grams).toBe(250);
      expect(twoUnits.kcal).toBe(150);
      expect(halfPot.grams).toBe(62.5);
    });

    it('returns UNIT_NOT_AVAILABLE when the product has no serving size', () => {
      expect(convertServing(milk, 1, 'unit')).toEqual({
        ok: false,
        error: 'UNIT_NOT_AVAILABLE',
      });
      expect(convertServing(milk, 1, 'pot')).toEqual({
        ok: false,
        error: 'UNIT_NOT_AVAILABLE',
      });
    });
  });

  describe('invalid input', () => {
    it('rejects a zero or negative quantity', () => {
      for (const quantity of [0, -1, -0.5]) {
        expect(convertServing(milk, quantity, 'g')).toEqual({
          ok: false,
          error: 'QUANTITY_INVALID',
        });
      }
    });

    it('rejects non-finite quantities', () => {
      for (const quantity of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(convertServing(milk, quantity, 'g')).toEqual({
          ok: false,
          error: 'QUANTITY_INVALID',
        });
      }
    });

    it('rejects unknown units without throwing', () => {
      expect(convertServing(milk, 1, 'bottle' as ServingUnit)).toEqual({
        ok: false,
        error: 'INVALID_UNIT',
      });
    });

    it('rejects invalid product nutrients', () => {
      expect(convertServing({ ...milk, kcal: -1 }, 100, 'g')).toEqual({
        ok: false,
        error: 'INVALID_PRODUCT',
      });
      expect(convertServing({ ...milk, protein: Number.NaN }, 100, 'g')).toEqual({
        ok: false,
        error: 'INVALID_PRODUCT',
      });
    });

    it('rejects invalid densities for volume units', () => {
      for (const densityGPerMl of [0, -1, Number.NaN]) {
        expect(convertServing({ ...milk, densityGPerMl }, 100, 'ml')).toEqual({
          ok: false,
          error: 'INVALID_PRODUCT',
        });
      }
    });

    it('rejects an invalid serving size', () => {
      expect(convertServing({ ...yogurtPot, servingQuantityG: 0 }, 1, 'pot')).toEqual({
        ok: false,
        error: 'INVALID_PRODUCT',
      });
    });
  });

  describe('precision', () => {
    it('retains full kcal and macro precision internally', () => {
      const result = expectSuccess(convertServing(milk, 2, 'glass'));

      expect(result.kcal).toBe(316.416);
      expect(result.protein).toBeCloseTo(16.8096);
      expect(result.carbs).toBeCloseTo(23.7312);
      expect(result.fat).toBeCloseTo(17.7984);
    });

    it('never returns NaN for any supported unit', () => {
      for (const unit of SERVING_UNITS) {
        const product =
          unit === 'cl' || unit === 'dl' || unit === 'l' || unit === 'fl_oz'
            ? liquid
            : unit === 'unit' || unit === 'pot' || unit === 'serving'
              ? yogurtPot
              : milk;
        const result = convertServing(product, 1, unit);

        expect(result.ok).toBe(true);

        if (result.ok) {
          for (const value of [
            result.grams,
            result.kcal,
            result.protein,
            result.carbs,
            result.fat,
          ]) {
            expect(Number.isNaN(value)).toBe(false);
            expect(Number.isFinite(value)).toBe(true);
          }
        }
      }
    });
  });

  describe('getAvailableServingUnits', () => {
    it('includes a serving unit when product has valid servingQuantityG', () => {
      const units = getAvailableServingUnits(yogurtPot);
      expect(units).toContain('unit');
      expect(units).not.toContain('pot');
      expect(units).toEqual(['g', 'kg', 'oz', 'unit']);
    });

    it('excludes serving units when servingQuantityG is undefined', () => {
      const units = getAvailableServingUnits(milk);
      expect(units).not.toContain('unit');
      expect(units).not.toContain('pot');
      expect(units).toEqual(['g', 'kg', 'oz', 'ml', 'tbsp', 'tsp', 'glass', 'cup']);
    });

    it('excludes unit and pot when servingQuantityG is zero or negative', () => {
      expect(getAvailableServingUnits({ ...yogurtPot, servingQuantityG: 0 })).not.toContain('unit');
      expect(getAvailableServingUnits({ ...yogurtPot, servingQuantityG: -10 })).not.toContain(
        'unit',
      );
    });

    it('uses the product density table for known foods', () => {
      expect(getAvailableServingUnits(milk, 'whole milk')).toContain('cup');
      expect(getAvailableServingUnits({ ...milk, densityGPerMl: undefined }, 'honey')).toContain(
        'tbsp',
      );
    });

    it('hides volume units for solids without a defined density', () => {
      const units = getAvailableServingUnits(
        { kcal: 100, protein: 2, carbs: 20, fat: 1 },
        'plain flour',
      );
      expect(units).not.toContain('ml');
      expect(units).not.toContain('tbsp');
      expect(units).toContain('g');
    });

    it('offers the supported volume units for liquids', () => {
      expect(getAvailableServingUnits(liquid)).toEqual([
        'ml',
        'cl',
        'dl',
        'l',
        'fl_oz',
        'cup',
        'tbsp',
        'tsp',
        'glass',
      ]);
    });

    it('allows volume units for solids when a density is explicitly provided', () => {
      expect(getAvailableServingUnits({ ...milk, densityGPerMl: 0.6 }, 'couscous')).toContain('ml');
    });
  });
});
