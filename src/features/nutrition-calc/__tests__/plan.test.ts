import { describe, expect, it } from '@jest/globals';

import { calculateNutritionPlan } from '../plan';
import type { CalculatorInput, Gender, Goal } from '../types';

const baseInput: CalculatorInput = {
  gender: 'male',
  age: 30,
  weightKg: 80,
  heightCm: 180,
  trainingDaysPerWeek: 3,
  goal: 'maintain',
};

function expectWithin(actual: number, expected: number, tolerance: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe('calculateNutritionPlan', () => {
  it('computes a maintenance plan', () => {
    const plan = calculateNutritionPlan(baseInput);

    expect(plan).toEqual({
      bmr: 1780,
      tdee: 2448,
      bmrFormula: 'mifflin-st-jeor',
      calories: 2448,
      proteinG: 160,
      fatG: 64,
      carbsG: 308,
      warnings: [],
    });
  });

  it('applies the cut calorie factor and higher protein', () => {
    const plan = calculateNutritionPlan({ ...baseInput, goal: 'cut' });

    expect(plan.calories).toBe(1958);
    expect(plan.proteinG).toBe(176);
    expect(plan.fatG).toBe(64);
    expect(plan.carbsG).toBe(170);
    expect(plan.warnings).toEqual([]);
  });

  it('applies the lean bulk calorie factor', () => {
    const plan = calculateNutritionPlan({ ...baseInput, goal: 'lean_bulk' });

    expect(plan.calories).toBe(2692);
    expect(plan.proteinG).toBe(160);
    expect(plan.fatG).toBe(64);
    expect(plan.carbsG).toBe(369);
    expect(plan.warnings).toEqual([]);
  });

  it('computes a female plan', () => {
    const plan = calculateNutritionPlan({
      gender: 'female',
      age: 30,
      weightKg: 60,
      heightCm: 165,
      trainingDaysPerWeek: 3,
      goal: 'maintain',
    });

    expect(plan.bmr).toBe(1320);
    expect(plan.tdee).toBe(1815);
    expect(plan.calories).toBe(1815);
    expect(plan.proteinG).toBe(120);
    expect(plan.fatG).toBe(48);
    expect(plan.carbsG).toBe(226);
    expect(plan.warnings).toEqual([]);
  });

  it.each([
    [0, 2136],
    [1, 2136],
    [2, 2448],
    [3, 2448],
    [4, 2759],
    [5, 2759],
    [6, 3071],
    [7, 3071],
  ])('uses the right multiplier for %i training days', (days, calories) => {
    const plan = calculateNutritionPlan({
      ...baseInput,
      trainingDaysPerWeek: days,
    });

    expect(plan.tdee).toBe(calories);
    expect(plan.calories).toBe(calories);
    expect(plan.warnings).toEqual([]);
  });

  it('prefers Katch-McArdle and applies the lean-mass protein cap', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 18 });

    expect(plan.bmrFormula).toBe('katch-mcardle');
    expect(plan.bmr).toBe(1787);
    expect(plan.tdee).toBe(2457);
    expect(plan.calories).toBe(2457);
    expect(plan.proteinG).toBe(144);
    expect(plan.fatG).toBe(64);
    expect(plan.carbsG).toBe(326);
    expect(plan.warnings).toEqual(['PROTEIN_CAPPED']);
  });

  it('matches the reference case for a 80 kg, 180 cm, 25 y male training 4 days', () => {
    const maintenance = calculateNutritionPlan({
      gender: 'male',
      age: 25,
      weightKg: 80,
      heightCm: 180,
      trainingDaysPerWeek: 4,
      goal: 'maintain',
    });

    expectWithin(maintenance.bmr, 1805, 5);
    expectWithin(maintenance.tdee, 2798, 5);
    expectWithin(maintenance.calories, 2798, 5);
    expectWithin(maintenance.proteinG, 160, 1);
    expectWithin(maintenance.fatG, 64, 1);
    expectWithin(maintenance.carbsG, 395, 1);
    expect(maintenance.warnings).toEqual([]);

    const cut = calculateNutritionPlan({
      gender: 'male',
      age: 25,
      weightKg: 80,
      heightCm: 180,
      trainingDaysPerWeek: 4,
      goal: 'cut',
    });

    expectWithin(cut.bmr, 1805, 5);
    expectWithin(cut.tdee, 2798, 5);
    expectWithin(cut.calories, 2238, 5);
    expectWithin(cut.proteinG, 176, 1);
    expectWithin(cut.fatG, 64, 1);
    expectWithin(cut.carbsG, 240, 1);
    expect(cut.warnings).toEqual([]);
  });

  it('raises a cut to BMR when the goal target would fall below it', () => {
    const plan = calculateNutritionPlan({
      gender: 'female',
      age: 30,
      weightKg: 60,
      heightCm: 165,
      trainingDaysPerWeek: 0,
      goal: 'cut',
    });

    expect(plan.bmr).toBe(1320);
    expect(plan.tdee).toBe(1584);
    expect(plan.calories).toBe(1321);
    expect(plan.proteinG).toBe(132);
    expect(plan.fatG).toBe(48);
    expect(plan.carbsG).toBe(90);
    expect(plan.warnings).toEqual(['CALORIES_RAISED_TO_FLOOR']);
  });

  it('enforces the 1500 kcal floor for men', () => {
    const plan = calculateNutritionPlan({
      gender: 'male',
      age: 30,
      weightKg: 50,
      heightCm: 160,
      trainingDaysPerWeek: 0,
      goal: 'cut',
    });

    expect(plan.bmr).toBe(1355);
    expect(plan.tdee).toBe(1626);
    expect(plan.calories).toBe(1500);
    expect(plan.proteinG).toBe(110);
    expect(plan.fatG).toBe(40);
    expect(plan.carbsG).toBe(175);
    expect(plan.warnings).toEqual(['CALORIES_RAISED_TO_FLOOR']);
  });

  it('enforces the 1200 kcal floor for women', () => {
    const plan = calculateNutritionPlan({
      gender: 'female',
      age: 30,
      weightKg: 45,
      heightCm: 155,
      trainingDaysPerWeek: 0,
      goal: 'cut',
    });

    expect(plan.bmr).toBe(1108);
    expect(plan.tdee).toBe(1329);
    expect(plan.calories).toBe(1200);
    expect(plan.proteinG).toBe(99);
    expect(plan.fatG).toBe(36);
    expect(plan.carbsG).toBe(120);
    expect(plan.warnings).toEqual(['CALORIES_RAISED_TO_FLOOR']);
  });

  it('combines the calorie floor with the protein cap for a heavy sedentary cut', () => {
    const plan = calculateNutritionPlan({
      gender: 'male',
      age: 40,
      weightKg: 150,
      heightCm: 170,
      trainingDaysPerWeek: 0,
      goal: 'cut',
    });

    expect(plan.bmr).toBe(2368);
    expect(plan.tdee).toBe(2841);
    expect(plan.calories).toBe(2368);
    expect(plan.proteinG).toBe(220);
    expect(plan.fatG).toBe(120);
    expect(plan.carbsG).toBe(102);
    expect(plan.warnings).toEqual(['CALORIES_RAISED_TO_FLOOR', 'PROTEIN_CAPPED']);
  });

  it('reduces fat to the floor when the calorie floor still leaves no carb room', () => {
    const plan = calculateNutritionPlan({
      gender: 'male',
      age: 100,
      weightKg: 100,
      heightCm: 50,
      trainingDaysPerWeek: 0,
      goal: 'cut',
    });

    expect(plan.bmr).toBe(818);
    expect(plan.tdee).toBe(981);
    expect(plan.calories).toBe(1500);
    expect(plan.proteinG).toBe(220);
    expect(plan.fatG).toBe(33);
    expect(plan.carbsG).toBe(81);
    expect(plan.warnings).toEqual(['CALORIES_RAISED_TO_FLOOR', 'FAT_REDUCED_TO_FLOOR']);
  });

  it('rounds every calorie value to a whole number', () => {
    const plan = calculateNutritionPlan({ ...baseInput, bodyFatPercent: 22 });

    expect(Number.isInteger(plan.bmr)).toBe(true);
    expect(Number.isInteger(plan.tdee)).toBe(true);
    expect(Number.isInteger(plan.calories)).toBe(true);
    expect(Number.isInteger(plan.proteinG)).toBe(true);
    expect(Number.isInteger(plan.fatG)).toBe(true);
    expect(Number.isInteger(plan.carbsG)).toBe(true);
  });

  describe('input validation', () => {
    it.each([
      ['gender', { gender: 'other' as Gender }],
      ['age below range', { age: 0 }],
      ['age above range', { age: 121 }],
      ['zero weight', { weightKg: 0 }],
      ['negative weight', { weightKg: -80 }],
      ['zero height', { heightCm: 0 }],
      ['too many training days', { trainingDaysPerWeek: 8 }],
      ['fractional training days', { trainingDaysPerWeek: 2.5 }],
      ['body fat at 0', { bodyFatPercent: 0 }],
      ['body fat at 100', { bodyFatPercent: 100 }],
      ['unknown goal', { goal: 'bulk' as Goal }],
    ])('rejects %s', (_label, override) => {
      expect(() => calculateNutritionPlan({ ...baseInput, ...override })).toThrow(RangeError);
    });
  });
});
