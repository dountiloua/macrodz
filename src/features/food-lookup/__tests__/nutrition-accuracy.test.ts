import { describe, expect, it } from '@jest/globals';

import { hasInconsistentCalories } from '../nutrition-accuracy';

describe('hasInconsistentCalories', () => {
  it('flags a large disagreement between reported and macro-derived calories', () => {
    expect(
      hasInconsistentCalories({
        kcal: 500,
        protein: 10,
        carbs: 10,
        fat: 2,
      }),
    ).toBe(true);
  });

  it('does not flag normal products', () => {
    expect(
      hasInconsistentCalories({
        kcal: 250,
        protein: 15,
        carbs: 25,
        fat: 10,
      }),
    ).toBe(false);
  });

  it('includes alcohol energy when checking alcoholic products', () => {
    expect(
      hasInconsistentCalories({
        kcal: 280,
        protein: 0,
        carbs: 0,
        fat: 0,
        alcohol: 40,
      }),
    ).toBe(false);
  });

  it('skips products when reported and expected calories are both under ten', () => {
    expect(
      hasInconsistentCalories({
        kcal: 1,
        protein: 0,
        carbs: 0.1,
        fat: 0,
      }),
    ).toBe(false);
  });
});
