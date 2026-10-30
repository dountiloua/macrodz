import { describe, expect, it } from '@jest/globals';

import { createHistoryFoodCandidates } from '../candidates';
import { suggestCloseMacros } from '../engine';
import type { CloseMacrosFoodCandidate, CloseMacrosRemaining } from '../types';

const exactRemaining: CloseMacrosRemaining = {
  kcal: 200,
  protein: 20,
  carbs: 40,
  fat: 4,
};

function food(overrides: Partial<CloseMacrosFoodCandidate> = {}): CloseMacrosFoodCandidate {
  return {
    id: 'exact',
    name: 'Exact food',
    kcal: 100,
    protein: 10,
    carbs: 20,
    fat: 2,
    source: 'generic',
    ...overrides,
  };
}

describe('suggestCloseMacros', () => {
  it('finds an exact single-food fit', () => {
    const result = suggestCloseMacros({
      remaining: exactRemaining,
      goal: 'maintain',
      foods: [food()],
    });

    expect(result.status).toBe('suggestions');
    if (result.status !== 'suggestions') return;
    expect(result.suggestions[0]).toMatchObject({
      items: [{ grams: 200 }],
      kcal: 200,
      protein: 20,
      carbs: 40,
      fat: 4,
    });
  });

  it('returns no suggestions when every allowed portion exceeds the calorie allowance', () => {
    const result = suggestCloseMacros({
      remaining: { kcal: 101, protein: 20, carbs: 20, fat: 10 },
      goal: 'maintain',
      foods: [food({ kcal: 1000, fat: 0 })],
    });

    expect(result).toEqual({ status: 'no_fit', suggestions: [] });
  });

  it('returns target reached with no suggestions below 100 kcal remaining', () => {
    const result = suggestCloseMacros({
      remaining: { kcal: 99, protein: 20, carbs: 20, fat: 10 },
      goal: 'maintain',
      foods: [food()],
    });

    expect(result).toEqual({ status: 'target_reached', suggestions: [] });
  });

  it('never exceeds the remaining calorie target for a cut goal', () => {
    const result = suggestCloseMacros({
      remaining: { kcal: 500, protein: 30, carbs: 40, fat: 20 },
      goal: 'cut',
      foods: [food({ kcal: 200, protein: 10, carbs: 0, fat: 0 })],
    });

    expect(result.status).toBe('suggestions');
    if (result.status !== 'suggestions') return;
    expect(result.suggestions.every((suggestion) => suggestion.kcal <= 500)).toBe(true);
  });

  it('keeps portions within declared bounds and defaults to 30–300 g otherwise', () => {
    const bounded = suggestCloseMacros({
      remaining: { kcal: 500, protein: 20, carbs: 40, fat: 10 },
      goal: 'maintain',
      foods: [food({ minPortionG: 80, maxPortionG: 90 })],
    });
    const defaultRange = suggestCloseMacros({
      remaining: { kcal: 500, protein: 20, carbs: 40, fat: 10 },
      goal: 'maintain',
      foods: [food()],
    });

    expect(bounded.status).toBe('suggestions');
    if (bounded.status === 'suggestions') {
      expect(bounded.suggestions[0].items[0].grams).toBeGreaterThanOrEqual(80);
      expect(bounded.suggestions[0].items[0].grams).toBeLessThanOrEqual(90);
    }
    expect(defaultRange.status).toBe('suggestions');
    if (defaultRange.status === 'suggestions') {
      expect(defaultRange.suggestions[0].items[0].grams).toBeGreaterThanOrEqual(30);
      expect(defaultRange.suggestions[0].items[0].grams).toBeLessThanOrEqual(300);
    }
  });

  it('uses name as a deterministic tie-breaker', () => {
    const foods = [food({ id: 'beta', name: 'Beta' }), food({ id: 'alpha', name: 'Alpha' })];
    const input = {
      remaining: { kcal: 200, protein: 20, carbs: 40, fat: 4 },
      goal: 'maintain' as const,
      foods,
    };
    const first = suggestCloseMacros(input);
    const second = suggestCloseMacros(input);

    expect(first).toEqual(second);
    expect(first.status).toBe('suggestions');
    if (first.status === 'suggestions') {
      expect(first.suggestions[0].items[0].food.name).toBe('Alpha');
    }
  });

  it('prefers a previously logged food for an equally good fit', () => {
    const result = suggestCloseMacros({
      remaining: exactRemaining,
      goal: 'maintain',
      foods: [
        food({ id: 'generic', name: 'Generic match' }),
        food({ id: 'history', name: 'Logged match', source: 'history' }),
      ],
    });

    expect(result.status).toBe('suggestions');
    if (result.status === 'suggestions') {
      expect(result.suggestions[0].items[0].food.source).toBe('history');
    }
  });

  it('scores two-food combinations and ranks an exact combination above either single', () => {
    const result = suggestCloseMacros({
      remaining: { kcal: 100, protein: 10, carbs: 10, fat: 0 },
      goal: 'maintain',
      foods: [
        food({
          id: 'protein',
          name: 'Protein food',
          kcal: 50,
          protein: 10,
          carbs: 0,
          fat: 0,
        }),
        food({
          id: 'carbs',
          name: 'Carb food',
          kcal: 50,
          protein: 0,
          carbs: 10,
          fat: 0,
        }),
      ],
    });

    expect(result.status).toBe('suggestions');
    if (result.status === 'suggestions') {
      expect(result.suggestions[0].items).toHaveLength(2);
      expect(result.suggestions[0]).toMatchObject({
        kcal: 100,
        protein: 10,
        carbs: 10,
        fat: 0,
        score: 0,
      });
    }
  });
});

describe('createHistoryFoodCandidates', () => {
  it('groups snapshots by product name and calculates gram-weighted per-100 g values', () => {
    const candidates = createHistoryFoodCandidates([
      {
        product_name: 'Yogurt',
        log_date: '2026-10-28',
        created_at: '2026-10-28T10:00:00.000Z',
        grams: 100,
        kcal: 60,
        protein: 4,
        carbs: 6,
        fat: 2,
      },
      {
        product_name: ' yogurt ',
        log_date: '2026-10-29',
        created_at: '2026-10-29T10:00:00.000Z',
        grams: 200,
        kcal: 120,
        protein: 8,
        carbs: 12,
        fat: 4,
      },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      name: 'yogurt',
      kcal: 60,
      protein: 4,
      carbs: 6,
      fat: 2,
      source: 'history',
    });
  });
});
