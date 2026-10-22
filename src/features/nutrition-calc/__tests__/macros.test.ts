import { describe, expect, it } from '@jest/globals';

import { calculateMacros } from '../macros';
import type { MacroResult } from '../types';

function macroKcal(result: MacroResult): number {
  return result.proteinG * 4 + result.carbsG * 4 + result.fatG * 9;
}

describe('calculateMacros', () => {
  it('computes a standard cut with no warnings', () => {
    const result = calculateMacros({ calories: 1958, weightKg: 80, goal: 'cut' });

    expect(result).toEqual({
      calories: 1958,
      proteinG: 176,
      fatG: 64,
      carbsG: 170,
      warnings: [],
    });
  });

  it('raises fat to 20% of calories when 0.8 g/kg is lower', () => {
    const result = calculateMacros({
      calories: 2747,
      weightKg: 50,
      goal: 'maintain',
    });

    expect(result.proteinG).toBe(100);
    expect(result.fatG).toBe(61);
    expect(result.carbsG).toBe(450);
    expect(result.warnings).toEqual([]);
    expect(macroKcal(result)).toBeCloseTo(2749, 5);
  });

  it('caps protein at 220 g when body fat is not provided', () => {
    const result = calculateMacros({ calories: 3000, weightKg: 120, goal: 'cut' });

    expect(result).toEqual({
      calories: 3000,
      proteinG: 220,
      fatG: 96,
      carbsG: 314,
      warnings: ['PROTEIN_CAPPED'],
    });
  });

  it('caps protein at 2.2 g/kg of lean mass when body fat is provided', () => {
    const result = calculateMacros({
      calories: 2600,
      weightKg: 120,
      bodyFatPercent: 30,
      goal: 'cut',
    });

    expect(result).toEqual({
      calories: 2600,
      proteinG: 185,
      fatG: 96,
      carbsG: 249,
      warnings: ['PROTEIN_CAPPED'],
    });
  });

  it('does not apply the 220 g cap when body fat gives a higher lean-mass cap', () => {
    const result = calculateMacros({
      calories: 4000,
      weightKg: 200,
      bodyFatPercent: 10,
      goal: 'cut',
    });

    expect(result.proteinG).toBe(396);
    expect(result.warnings).toEqual(['PROTEIN_CAPPED']);
  });

  it('reduces fat to its floor when protein and fat do not fit', () => {
    const result = calculateMacros({ calories: 1500, weightKg: 100, goal: 'cut' });

    expect(result).toEqual({
      calories: 1500,
      proteinG: 220,
      fatG: 33,
      carbsG: 81,
      warnings: ['FAT_REDUCED_TO_FLOOR'],
    });
    expect(macroKcal(result)).toBeCloseTo(1501, 5);
  });

  it('reduces protein to 1.6 g/kg when the fat floor still leaves negative carbs', () => {
    const result = calculateMacros({
      calories: 1800,
      weightKg: 200,
      bodyFatPercent: 10,
      goal: 'cut',
    });

    expect(result).toEqual({
      calories: 1800,
      proteinG: 320,
      fatG: 40,
      carbsG: 40,
      warnings: ['PROTEIN_CAPPED', 'FAT_REDUCED_TO_FLOOR', 'PROTEIN_REDUCED'],
    });
    expect(macroKcal(result)).toBe(1800);
  });

  it('raises calories when even the minimum macros do not fit', () => {
    const result = calculateMacros({ calories: 785, weightKg: 100, goal: 'cut' });

    expect(result).toEqual({
      calories: 793,
      proteinG: 160,
      fatG: 17,
      carbsG: 0,
      warnings: ['FAT_REDUCED_TO_FLOOR', 'PROTEIN_REDUCED', 'CALORIES_RAISED'],
    });
    expect(macroKcal(result)).toBe(793);
  });

  it('never returns negative values', () => {
    const cases = [
      { calories: 1958, weightKg: 80, goal: 'cut' as const },
      { calories: 1500, weightKg: 100, goal: 'cut' as const },
      { calories: 1800, weightKg: 200, bodyFatPercent: 10, goal: 'cut' as const },
      { calories: 785, weightKg: 100, goal: 'cut' as const },
      { calories: 1200, weightKg: 40, goal: 'maintain' as const },
      { calories: 4000, weightKg: 120, goal: 'lean_bulk' as const },
    ];

    for (const input of cases) {
      const result = calculateMacros(input);
      expect(result.calories).toBeGreaterThanOrEqual(0);
      expect(result.proteinG).toBeGreaterThanOrEqual(0);
      expect(result.fatG).toBeGreaterThanOrEqual(0);
      expect(result.carbsG).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns whole grams and keeps totals within 5 kcal', () => {
    for (const goal of ['cut', 'maintain', 'lean_bulk'] as const) {
      for (const weightKg of [45, 60, 80, 100, 150]) {
        const result = calculateMacros({ calories: 2200, weightKg, goal });

        expect(Number.isInteger(result.proteinG)).toBe(true);
        expect(Number.isInteger(result.fatG)).toBe(true);
        expect(Number.isInteger(result.carbsG)).toBe(true);
        expect(Number.isInteger(result.calories)).toBe(true);

        if (result.warnings.includes('CALORIES_RAISED')) {
          expect(macroKcal(result)).toBe(result.calories);
        } else {
          expect(Math.abs(macroKcal(result) - result.calories)).toBeLessThanOrEqual(5);
        }
      }
    }
  });
});
