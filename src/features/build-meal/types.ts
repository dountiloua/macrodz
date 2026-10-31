import type { DiaryFood, Meal } from '@/features/diary/types';
import type { ServingUnit } from '@/features/serving-units';

export type BuildMealItem = DiaryFood & {
  id: string;
  barcode?: string;
  imageUrl?: string;
  quantity: number;
  unit: ServingUnit;
};

export type BuildMealTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type BuildMealSaveInput = {
  userId: string;
  date: string;
  meal: Meal;
  items: readonly BuildMealItem[];
};
