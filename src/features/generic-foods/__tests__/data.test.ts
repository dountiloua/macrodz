import { describe, expect, it } from '@jest/globals';

import { getAvailableServingUnits } from '../../serving-units';
import { GENERIC_FOODS } from '../data';

describe('generic food kinds', () => {
  it('marks drink and soup entries as liquids with only liquid serving units', () => {
    const liquidIds = ['milk', 'lben', 'raib', 'water', 'chorba', 'juice', 'coffee'];

    for (const id of liquidIds) {
      const food = GENERIC_FOODS.find((candidate) => candidate.id === id);
      expect(food).toBeDefined();
      if (!food) throw new Error(`Missing generic food: ${id}`);
      expect(food?.kind).toBe('liquid');
      expect(getAvailableServingUnits(food, food.names.en)).toEqual([
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
    }
  });
});
