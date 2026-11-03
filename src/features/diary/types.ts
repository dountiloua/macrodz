import type { ProductKind, ServingUnit } from '../serving-units';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

export type DiaryEntry = {
  id: string;
  user_id: string;
  product_id: string | null;
  product_name: string;
  log_date: string;
  meal: Meal;
  quantity: number;
  unit: ServingUnit;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
};

export type DiaryEntryValues = Pick<
  DiaryEntry,
  | 'user_id'
  | 'product_id'
  | 'product_name'
  | 'log_date'
  | 'meal'
  | 'quantity'
  | 'unit'
  | 'grams'
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'fat'
>;

export type DiaryFoodHistorySnapshot = Pick<
  DiaryEntry,
  | 'product_name'
  | 'log_date'
  | 'created_at'
  | 'grams'
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'fat'
> & { quantity?: number; unit?: ServingUnit };

export type DiaryTotals = Pick<DiaryEntry, 'kcal' | 'protein' | 'carbs' | 'fat'>;

export type DiaryFood = {
  kind?: ProductKind;
  name: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  source?: 'off' | 'user' | 'generic';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars?: number;
  fiber?: number;
  saturatedFat?: number;
  salt?: number;
  alcohol?: number;
  servingQuantityG?: number;
  densityGPerMl?: number;
  productId?: string;
};

export type LogFoodParams = {
  date: string;
  meal: Meal;
  name: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  grams?: string;
  productId?: string;
  servingQuantityG?: string;
  densityGPerMl?: string;
  kind?: ProductKind;
  entryId?: string;
  quantity?: string;
  unit?: string;
  productSheet?: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  source?: 'off' | 'user' | 'generic';
  sugars?: string;
  fiber?: string;
  saturatedFat?: string;
  salt?: string;
  alcohol?: string;
};
