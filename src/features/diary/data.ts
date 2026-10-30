import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { convertServing, type ServingUnit } from '@/features/serving-units';

import {
  MEALS,
  type DiaryEntry,
  type DiaryEntryValues,
  type DiaryFood,
  type DiaryFoodHistorySnapshot,
  type Meal,
} from './types';

export class DiaryDataError extends Error {
  constructor() {
    super('Diary data operation failed');
    this.name = 'DiaryDataError';
  }
}

function fail(error: unknown): never {
  console.error('Diary data operation failed.', error);
  throw new DiaryDataError();
}

export async function listDiaryEntries(
  userId: string,
  date: string,
  client: SupabaseClient = supabase,
): Promise<DiaryEntry[]> {
  try {
    const { data, error } = await client
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', date)
      .order('created_at', { ascending: true });

    if (error) {
      return fail(error);
    }

    return (data ?? []) as DiaryEntry[];
  } catch (error) {
    if (error instanceof DiaryDataError) throw error;
    return fail(error);
  }
}

export async function listDiaryFoodHistory(
  userId: string,
  throughDate: string,
  client: SupabaseClient = supabase,
): Promise<DiaryFoodHistorySnapshot[]> {
  const pageSize = 500;
  const entries: DiaryFoodHistorySnapshot[] = [];

  try {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client
        .from('food_logs')
        .select('product_name, log_date, created_at, grams, kcal, protein, carbs, fat')
        .eq('user_id', userId)
        .lte('log_date', throughDate)
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) return fail(error);

      const page = (data ?? []) as DiaryFoodHistorySnapshot[];
      entries.push(...page);
      if (page.length < pageSize) return entries;
    }
  } catch (error) {
    if (error instanceof DiaryDataError) throw error;
    return fail(error);
  }
}

export async function addDiaryEntry(
  values: DiaryEntryValues,
  client: SupabaseClient = supabase,
): Promise<DiaryEntry> {
  try {
    const { data, error } = await client.from('food_logs').insert(values).select('*').single();

    if (error || data === null) {
      return fail(error ?? new Error('Empty diary insert result'));
    }

    return data as DiaryEntry;
  } catch (error) {
    if (error instanceof DiaryDataError) throw error;
    return fail(error);
  }
}

export async function updateDiaryEntry(
  userId: string,
  entryId: string,
  values: Pick<
    DiaryEntryValues,
    'quantity' | 'unit' | 'grams' | 'kcal' | 'protein' | 'carbs' | 'fat'
  >,
  client: SupabaseClient = supabase,
): Promise<DiaryEntry> {
  try {
    const { data, error } = await client
      .from('food_logs')
      .update(values)
      .eq('id', entryId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || data === null) {
      return fail(error ?? new Error('Empty diary update result'));
    }

    return data as DiaryEntry;
  } catch (error) {
    if (error instanceof DiaryDataError) throw error;
    return fail(error);
  }
}

export async function deleteDiaryEntry(
  userId: string,
  entryId: string,
  client: SupabaseClient = supabase,
): Promise<void> {
  try {
    const { error } = await client
      .from('food_logs')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) {
      return fail(error);
    }
  } catch (error) {
    if (error instanceof DiaryDataError) throw error;
    return fail(error);
  }
}

export async function insertUserProduct(
  userId: string,
  product: DiaryFood & { barcode: string; brand?: string },
  client: SupabaseClient = supabase,
): Promise<string> {
  const barcode = product.barcode.trim();
  const name = product.name.trim();
  const brand = product.brand?.trim();
  if (
    !/^\d{8,14}$/.test(barcode) ||
    name.length === 0 ||
    name.length > 200 ||
    (brand !== undefined && brand.length > 200) ||
    ![product.kcal, product.protein, product.carbs, product.fat].every(Number.isFinite) ||
    product.kcal < 0 ||
    product.kcal > 900 ||
    product.protein < 0 ||
    product.carbs < 0 ||
    product.fat < 0 ||
    product.protein + product.carbs + product.fat > 100 ||
    (product.servingQuantityG !== undefined &&
      (product.servingQuantityG <= 0 || product.servingQuantityG > 10_000)) ||
    (product.densityGPerMl !== undefined &&
      (product.densityGPerMl <= 0 || product.densityGPerMl > 5))
  ) {
    throw new DiaryDataError();
  }

  try {
    const { data, error } = await client
      .from('products')
      .insert({
        barcode,
        name,
        brand: brand ?? null,
        kcal: product.kcal,
        protein: product.protein,
        carbs: product.carbs,
        fat: product.fat,
        serving_quantity_g: product.servingQuantityG ?? null,
        density_g_per_ml: product.densityGPerMl ?? null,
        source: 'user',
        verified: false,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error || data === null) {
      return fail(error ?? new Error('Empty user product insert result'));
    }

    return data.id;
  } catch (error) {
    if (error instanceof DiaryDataError) throw error;
    return fail(error);
  }
}

export async function findProductIdByBarcode(
  barcode: string,
  client: SupabaseClient = supabase,
): Promise<string | undefined> {
  try {
    const { data, error } = await client
      .from('products')
      .select('id')
      .eq('barcode', barcode)
      .maybeSingle();

    if (error) {
      return fail(error);
    }

    return data?.id;
  } catch (error) {
    if (error instanceof DiaryDataError) throw error;
    return fail(error);
  }
}

export function createDiaryEntryValues(input: {
  userId: string;
  date: string;
  meal: Meal;
  food: DiaryFood;
  quantity: number;
  unit: ServingUnit;
}): DiaryEntryValues {
  const { userId, date, meal, food, quantity, unit } = input;
  const [year, month, day] = date.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);
  const dateIsValid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(year) &&
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day;
  if (
    !dateIsValid ||
    !(MEALS as readonly string[]).includes(meal) ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 10_000 ||
    food.name.trim().length === 0 ||
    food.name.trim().length > 200 ||
    unit.length === 0 ||
    unit.length > 20
  ) {
    throw new DiaryDataError();
  }

  const conversion = convertServing(
    {
      kcal: food.kcal,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      servingQuantityG: food.servingQuantityG,
      densityGPerMl: food.densityGPerMl,
    },
    quantity,
    unit,
  );

  if (!conversion.ok || conversion.grams > 10_000) {
    throw new DiaryDataError();
  }

  const { grams, kcal, protein, carbs, fat } = conversion;
  if (kcal > 20_000 || protein > 5_000 || carbs > 5_000 || fat > 5_000) {
    throw new DiaryDataError();
  }

  return {
    user_id: userId,
    product_id: food.productId ?? null,
    product_name: food.name.trim(),
    log_date: date,
    meal,
    quantity,
    unit,
    grams,
    kcal,
    protein,
    carbs,
    fat,
  };
}
