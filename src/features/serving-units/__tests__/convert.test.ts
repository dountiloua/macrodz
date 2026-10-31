import { describe, expect, it } from '@jest/globals';

import { SERVING_UNITS, type ServingUnit } from '../constants';
import { convertServing, getAvailableServingUnits } from '../convert';
import { PRODUCT_DENSITIES_G_PER_ML } from '../density';
import type { ServingConversionResult, ServingConversionSuccess, ServingProduct } from '../types';

const milk: ServingProduct = {
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
  });

  describe('mass and volume conversions', () => {
    it('converts grams directly without using density', () => {
      expect(expectSuccess(convertServing(milk, 150, 'g'))).toEqual({
        ok: true,
        grams: 150,
        kcal: 96,
        protein: 5.1,
        carbs: 7.2,
        fat: 5.4,
      });
    });

    it('uses density for milliliters', () => {
      const result = expectSuccess(convertServing(oil, 100, 'ml'));

      expect(result.grams).toBe(92);
      expect(result.kcal).toBe(813);
      expect(result.fat).toBe(92);
    });

    it('defaults density to 1 when it is not provided', () => {
      const water: ServingProduct = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
      const result = expectSuccess(convertServing(water, 250, 'ml'));

      expect(result.grams).toBe(250);
      expect(result.kcal).toBe(0);
    });

    it('applies the configured tablespoon, teaspoon, glass and cup sizes', () => {
      const tablespoon = expectSuccess(convertServing(oil, 1, 'tbsp'));
      const teaspoons = expectSuccess(convertServing(oil, 3, 'tsp'));
      const cup = expectSuccess(convertServing(milk, 1, 'cup'));
      const glass = expectSuccess(convertServing(milk, 1, 'glass'));

      expect(tablespoon.grams).toBe(13.8);
      expect(teaspoons.grams).toBe(13.8);
      expect(cup).toEqual(glass);
      expect(cup.grams).toBe(247.2);
    });
  });

  describe('hand-checked examples', () => {
    it('converts 2 glasses of milk', () => {
      expect(expectSuccess(convertServing(milk, 2, 'glass'))).toEqual({
        ok: true,
        grams: 494.4,
        kcal: 316,
        protein: 16.8,
        carbs: 23.7,
        fat: 17.8,
      });
    });

    it('converts 1 tablespoon of oil', () => {
      expect(expectSuccess(convertServing(oil, 1, 'tbsp'))).toEqual({
        ok: true,
        grams: 13.8,
        kcal: 122,
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
        protein: 4.4,
        carbs: 8.8,
        fat: 1.9,
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

  describe('rounding', () => {
    it('rounds kcal to a whole number and macros to one decimal', () => {
      const result = expectSuccess(convertServing(milk, 2, 'glass'));

      expect(Number.isInteger(result.kcal)).toBe(true);
      expect(result.protein).toBe(16.8);
      expect(result.carbs).toBe(23.7);
      expect(result.fat).toBe(17.8);
    });

    it('never returns NaN for any supported unit', () => {
      for (const unit of SERVING_UNITS) {
        const product = unit === 'unit' || unit === 'pot' ? yogurtPot : milk;
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
    it('includes unit and pot when product has valid servingQuantityG', () => {
      const units = getAvailableServingUnits(yogurtPot);
      expect(units).toContain('unit');
      expect(units).toContain('pot');
      expect(units).toEqual(SERVING_UNITS);
    });

    it('excludes unit and pot when servingQuantityG is undefined', () => {
      const units = getAvailableServingUnits(milk);
      expect(units).not.toContain('unit');
      expect(units).not.toContain('pot');
      expect(units).toEqual(['g', 'ml', 'tbsp', 'tsp', 'glass', 'cup']);
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

    it('allows volume units for solids when a density is explicitly provided', () => {
      expect(getAvailableServingUnits({ ...milk, densityGPerMl: 0.6 }, 'couscous')).toContain('ml');
    });
  });
});
