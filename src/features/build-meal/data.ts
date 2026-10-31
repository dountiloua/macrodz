import { randomUUID } from 'expo-crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createDiaryEntryValues, DiaryDataError } from '@/features/diary/data';
import { supabase } from '@/lib/supabase';

import type { createBuildMealStore } from './store';
import type { BuildMealSaveInput } from './types';

export async function saveBuildMeal(
  input: BuildMealSaveInput,
  client: SupabaseClient = supabase,
  createId: () => string = randomUUID,
): Promise<void> {
  const rows = input.items.map((item) => ({
    id: createId(),
    ...createDiaryEntryValues({
      userId: input.userId,
      date: input.date,
      meal: input.meal,
      food: item,
      quantity: item.quantity,
      unit: item.unit,
    }),
  }));

  try {
    const { error } = await client.from('food_logs').insert(rows);
    if (error) {
      console.error('Unable to save build-meal entries.', error);
      throw new DiaryDataError();
    }
  } catch (error) {
    if (error instanceof DiaryDataError) throw error;
    console.error('Unable to save build-meal entries.', error);
    throw new DiaryDataError();
  }
}

export async function saveBuildMealAndClear(
  input: Omit<BuildMealSaveInput, 'items'>,
  store: ReturnType<typeof createBuildMealStore>,
  client: SupabaseClient = supabase,
  createId: () => string = randomUUID,
): Promise<void> {
  const items = store.getState().items;
  await saveBuildMeal({ ...input, items }, client, createId);
  for (const item of items) {
    store.getState().removeItem(item.id);
  }
}
