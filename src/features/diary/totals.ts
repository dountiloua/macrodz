import type { DiaryEntry, DiaryTotals } from './types';

export function sumDiaryTotals(entries: readonly DiaryEntry[]): DiaryTotals {
  return entries.reduce(
    (totals, entry) => ({
      kcal: totals.kcal + entry.kcal,
      protein: totals.protein + entry.protein,
      carbs: totals.carbs + entry.carbs,
      fat: totals.fat + entry.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
