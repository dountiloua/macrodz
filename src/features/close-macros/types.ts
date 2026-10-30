import type { Goal } from '@/features/nutrition-calc';

export type CloseMacrosRemaining = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type CloseMacrosFoodCandidate = {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'generic' | 'history';
  servingQuantityG?: number;
  minPortionG?: number;
  maxPortionG?: number;
};

export type CloseMacrosGoal = Goal;

export type CloseMacrosSuggestionItem = {
  food: CloseMacrosFoodCandidate;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type CloseMacrosSuggestion = {
  items: CloseMacrosSuggestionItem[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  score: number;
};

export type CloseMacrosResult =
  | { status: 'target_reached'; suggestions: [] }
  | { status: 'no_fit'; suggestions: [] }
  | { status: 'suggestions'; suggestions: CloseMacrosSuggestion[] };
