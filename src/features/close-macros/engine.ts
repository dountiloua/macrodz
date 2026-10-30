import type {
  CloseMacrosFoodCandidate,
  CloseMacrosGoal,
  CloseMacrosRemaining,
  CloseMacrosResult,
  CloseMacrosSuggestion,
  CloseMacrosSuggestionItem,
} from './types';

const DEFAULT_MIN_PORTION_G = 30;
const DEFAULT_MAX_PORTION_G = 300;
const SERVING_MIN_FACTOR = 0.5;
const SERVING_MAX_FACTOR = 3;
const MAX_SUGGESTIONS = 5;
const FAMILIARITY_BONUS = 0.025;

type PortionBounds = { min: number; max: number };

function getPortionBounds(food: CloseMacrosFoodCandidate): PortionBounds | null {
  const servingIsValid =
    food.servingQuantityG !== undefined &&
    Number.isFinite(food.servingQuantityG) &&
    food.servingQuantityG > 0;
  const min =
    food.minPortionG ??
    (servingIsValid
      ? Math.max(1, Math.round(food.servingQuantityG! * SERVING_MIN_FACTOR))
      : DEFAULT_MIN_PORTION_G);
  const max =
    food.maxPortionG ??
    (servingIsValid
      ? Math.max(min, Math.round(food.servingQuantityG! * SERVING_MAX_FACTOR))
      : DEFAULT_MAX_PORTION_G);

  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max < min) return null;
  return { min: Math.ceil(min), max: Math.floor(max) };
}

function isValidFood(food: CloseMacrosFoodCandidate): boolean {
  return (
    food.id.length > 0 &&
    food.name.trim().length > 0 &&
    [food.kcal, food.protein, food.carbs, food.fat].every(
      (value) => Number.isFinite(value) && value >= 0,
    )
  );
}

function candidateSignature(food: CloseMacrosFoodCandidate): string {
  return food.name.trim().toLowerCase();
}

function prepareFoods(foods: readonly CloseMacrosFoodCandidate[]): CloseMacrosFoodCandidate[] {
  const byName = new Map<string, CloseMacrosFoodCandidate>();
  for (const food of foods) {
    if (!isValidFood(food) || !getPortionBounds(food)) continue;
    const key = candidateSignature(food);
    const existing = byName.get(key);
    if (!existing || (food.source === 'history' && existing.source !== 'history')) {
      byName.set(key, food);
    }
  }
  return [...byName.values()].sort(compareFoodsByName);
}

function compareFoodsByName(
  left: CloseMacrosFoodCandidate,
  right: CloseMacrosFoodCandidate,
): number {
  const leftName = left.name.toLowerCase();
  const rightName = right.name.toLowerCase();
  if (leftName !== rightName) return leftName < rightName ? -1 : 1;
  return left.id < right.id ? -1 : left.id === right.id ? 0 : 1;
}

function scoreMacros(
  totals: Pick<CloseMacrosSuggestion, 'protein' | 'carbs' | 'fat'>,
  remaining: CloseMacrosRemaining,
): number {
  const proteinError = (totals.protein - remaining.protein) / Math.max(10, remaining.protein);
  const carbsError = (totals.carbs - remaining.carbs) / Math.max(10, remaining.carbs);
  const fatError = (totals.fat - remaining.fat) / Math.max(5, remaining.fat);
  return 3 * proteinError ** 2 + carbsError ** 2 + fatError ** 2;
}

function makeItem(food: CloseMacrosFoodCandidate, grams: number): CloseMacrosSuggestionItem {
  const factor = grams / 100;
  return {
    food,
    grams,
    kcal: food.kcal * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
  };
}

function makeSuggestion(
  items: CloseMacrosSuggestionItem[],
  remaining: CloseMacrosRemaining,
): CloseMacrosSuggestion {
  const orderedItems = [...items].sort((left, right) => compareFoodsByName(left.food, right.food));
  const totals = orderedItems.reduce(
    (result, item) => ({
      kcal: result.kcal + item.kcal,
      protein: result.protein + item.protein,
      carbs: result.carbs + item.carbs,
      fat: result.fat + item.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const familiarity = orderedItems.filter((item) => item.food.source === 'history').length;
  return {
    items: orderedItems,
    ...totals,
    score: scoreMacros(totals, remaining) - familiarity * FAMILIARITY_BONUS,
  };
}

function fitsLimits(kcal: number, fat: number, maxKcal: number, maxFat: number): boolean {
  return kcal <= maxKcal + 1e-9 && fat <= maxFat + 1e-9;
}

function findBestSingle(
  food: CloseMacrosFoodCandidate,
  bounds: PortionBounds,
  remaining: CloseMacrosRemaining,
  maxKcal: number,
  maxFat: number,
): CloseMacrosSuggestion | null {
  let best: CloseMacrosSuggestion | null = null;
  for (let grams = bounds.min; grams <= bounds.max; grams += 1) {
    const suggestion = makeSuggestion([makeItem(food, grams)], remaining);
    if (!fitsLimits(suggestion.kcal, suggestion.fat, maxKcal, maxFat)) continue;
    if (!best || suggestion.score < best.score) best = suggestion;
  }
  return best;
}

function getMaximumFeasibleGrams(
  food: CloseMacrosFoodCandidate,
  bounds: PortionBounds,
  kcalBudget: number,
  fatBudget: number,
): number {
  let max = bounds.max;
  if (food.kcal > 0) max = Math.min(max, Math.floor((kcalBudget * 100) / food.kcal));
  if (food.fat > 0) max = Math.min(max, Math.floor((fatBudget * 100) / food.fat));
  return max;
}

function findBestPair(
  first: CloseMacrosFoodCandidate,
  second: CloseMacrosFoodCandidate,
  firstBounds: PortionBounds,
  secondBounds: PortionBounds,
  remaining: CloseMacrosRemaining,
  maxKcal: number,
  maxFat: number,
): CloseMacrosSuggestion | null {
  const weights = [
    { key: 'protein' as const, weight: 3, floor: 10 },
    { key: 'carbs' as const, weight: 1, floor: 10 },
    { key: 'fat' as const, weight: 1, floor: 5 },
  ].map(({ key, weight, floor }) => ({
    key,
    scale: weight / Math.max(floor, remaining[key]) ** 2,
  }));

  const firstMaximum = getMaximumFeasibleGrams(first, firstBounds, maxKcal, maxFat);
  let best: CloseMacrosSuggestion | null = null;

  for (let firstGrams = firstBounds.min; firstGrams <= firstMaximum; firstGrams += 1) {
    const firstItem = makeItem(first, firstGrams);
    const kcalBudget = maxKcal - firstItem.kcal;
    const fatBudget = maxFat - firstItem.fat;
    const secondMaximum = getMaximumFeasibleGrams(second, secondBounds, kcalBudget, fatBudget);
    if (secondMaximum < secondBounds.min) continue;

    let numerator = 0;
    let denominator = 0;
    for (const { key, scale } of weights) {
      const rate = second[key] / 100;
      const residual = remaining[key] - firstItem[key];
      numerator += scale * rate * residual;
      denominator += scale * rate ** 2;
    }

    const optimum =
      denominator === 0
        ? secondBounds.min
        : Math.min(secondMaximum, Math.max(secondBounds.min, numerator / denominator));
    const options = new Set([
      secondBounds.min,
      secondMaximum,
      Math.floor(optimum),
      Math.ceil(optimum),
    ]);

    for (const secondGrams of options) {
      if (secondGrams < secondBounds.min || secondGrams > secondMaximum) continue;
      const suggestion = makeSuggestion([firstItem, makeItem(second, secondGrams)], remaining);
      if (!fitsLimits(suggestion.kcal, suggestion.fat, maxKcal, maxFat)) continue;
      if (!best || suggestion.score < best.score) best = suggestion;
    }
  }

  return best;
}

function signature(suggestion: CloseMacrosSuggestion): string {
  return suggestion.items
    .map((item) => `${item.food.id}:${item.grams}`)
    .sort()
    .join('|');
}

function compareSuggestions(left: CloseMacrosSuggestion, right: CloseMacrosSuggestion): number {
  if (Math.abs(left.score - right.score) > 1e-12) {
    return left.score < right.score ? -1 : 1;
  }

  const leftFamiliarCount = left.items.filter((item) => item.food.source === 'history').length;
  const rightFamiliarCount = right.items.filter((item) => item.food.source === 'history').length;
  if (leftFamiliarCount !== rightFamiliarCount) {
    return rightFamiliarCount - leftFamiliarCount;
  }
  if (left.items.length !== right.items.length) return left.items.length - right.items.length;

  const leftName = left.items.map((item) => item.food.name.toLowerCase()).join(' + ');
  const rightName = right.items.map((item) => item.food.name.toLowerCase()).join(' + ');
  if (leftName !== rightName) return leftName < rightName ? -1 : 1;

  const leftSignature = signature(left);
  const rightSignature = signature(right);
  return leftSignature < rightSignature ? -1 : leftSignature === rightSignature ? 0 : 1;
}

export function suggestCloseMacros(input: {
  remaining: CloseMacrosRemaining;
  goal: CloseMacrosGoal;
  foods: readonly CloseMacrosFoodCandidate[];
}): CloseMacrosResult {
  const { remaining, goal } = input;
  if (!Object.values(remaining).every(Number.isFinite)) {
    throw new RangeError('Remaining macro values must be finite numbers.');
  }
  if (remaining.kcal < 100) return { status: 'target_reached', suggestions: [] };

  const calorieAllowance = goal === 'cut' ? 1 : 1.05;
  const maxKcal = remaining.kcal * calorieAllowance;
  const maxFat = remaining.fat * 1.1;
  if (maxKcal < 0 || maxFat < 0) return { status: 'no_fit', suggestions: [] };

  const foods = prepareFoods(input.foods);
  const bounds = new Map(foods.map((food) => [food.id, getPortionBounds(food)!]));
  const suggestions: CloseMacrosSuggestion[] = [];

  for (const food of foods) {
    const suggestion = findBestSingle(food, bounds.get(food.id)!, remaining, maxKcal, maxFat);
    if (suggestion) suggestions.push(suggestion);
  }

  for (let firstIndex = 0; firstIndex < foods.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < foods.length; secondIndex += 1) {
      const suggestion = findBestPair(
        foods[firstIndex],
        foods[secondIndex],
        bounds.get(foods[firstIndex].id)!,
        bounds.get(foods[secondIndex].id)!,
        remaining,
        maxKcal,
        maxFat,
      );
      if (suggestion) suggestions.push(suggestion);
    }
  }

  const unique = new Map<string, CloseMacrosSuggestion>();
  for (const suggestion of suggestions) unique.set(signature(suggestion), suggestion);
  const topSuggestions = [...unique.values()].sort(compareSuggestions).slice(0, MAX_SUGGESTIONS);
  return topSuggestions.length > 0
    ? { status: 'suggestions', suggestions: topSuggestions }
    : { status: 'no_fit', suggestions: [] };
}
