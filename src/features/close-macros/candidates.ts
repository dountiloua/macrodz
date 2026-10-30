import type { DiaryFoodHistorySnapshot } from '@/features/diary/types';
import type { GenericFood } from '@/features/generic-foods';

import type { CloseMacrosFoodCandidate } from './types';

export function createGenericFoodCandidates(
  foods: readonly GenericFood[],
  language: 'en' | 'fr',
): CloseMacrosFoodCandidate[] {
  return foods.map((food) => ({
    id: `generic:${food.id}`,
    name: food.names[language],
    kcal: food.kcal,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    source: 'generic',
    ...(food.servingQuantityG === undefined ? {} : { servingQuantityG: food.servingQuantityG }),
  }));
}

export function createHistoryFoodCandidates(
  entries: readonly DiaryFoodHistorySnapshot[],
): CloseMacrosFoodCandidate[] {
  const grouped = new Map<
    string,
    {
      name: string;
      grams: number;
      kcal: number;
      protein: number;
      carbs: number;
      fat: number;
    }
  >();

  for (const entry of [...entries].sort(compareHistoryEntries)) {
    const name = entry.product_name.trim();
    const grams = entry.grams;
    if (
      name.length === 0 ||
      !Number.isFinite(grams) ||
      grams <= 0 ||
      ![entry.kcal, entry.protein, entry.carbs, entry.fat].every(
        (value) => Number.isFinite(value) && value >= 0,
      )
    ) {
      continue;
    }

    const key = name.toLowerCase();
    const aggregate = grouped.get(key) ?? {
      name,
      grams: 0,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    aggregate.grams += grams;
    aggregate.kcal += entry.kcal;
    aggregate.protein += entry.protein;
    aggregate.carbs += entry.carbs;
    aggregate.fat += entry.fat;
    grouped.set(key, aggregate);
  }

  return [...grouped.entries()].map(([key, aggregate]) => {
    const per100G = 100 / aggregate.grams;
    return {
      id: `history:${key}`,
      name: aggregate.name,
      kcal: aggregate.kcal * per100G,
      protein: aggregate.protein * per100G,
      carbs: aggregate.carbs * per100G,
      fat: aggregate.fat * per100G,
      source: 'history',
    };
  });
}

function compareHistoryEntries(
  left: DiaryFoodHistorySnapshot,
  right: DiaryFoodHistorySnapshot,
): number {
  const dateOrder = right.log_date.localeCompare(left.log_date);
  if (dateOrder !== 0) return dateOrder;
  const createdOrder = right.created_at.localeCompare(left.created_at);
  if (createdOrder !== 0) return createdOrder;
  const leftName = left.product_name.trim().toLowerCase();
  const rightName = right.product_name.trim().toLowerCase();
  return leftName < rightName ? -1 : leftName === rightName ? 0 : 1;
}
