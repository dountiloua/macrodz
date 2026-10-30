import { describe, expect, it } from '@jest/globals';

import { searchGenericFoods } from '../data';
import { getNutritionPer100g } from '../../diary/nutrition';

describe('searchGenericFoods', () => {
  it('matches case-insensitively and ignores accents', () => {
    expect(searchGenericFoods('BOEUF').map((food) => food.id)).toContain('beef');
    expect(searchGenericFoods('oeuf').map((food) => food.id)).toContain('egg');
    expect(searchGenericFoods('khobz')).toHaveLength(1);
  });

  it('provides kcal and P/C/F values per 100 g for result rows', () => {
    const khobz = searchGenericFoods('khobz')[0];
    expect(getNutritionPer100g(khobz)).toEqual({
      kcal: khobz.kcal,
      protein: khobz.protein,
      carbs: khobz.carbs,
      fat: khobz.fat,
    });
  });
});
