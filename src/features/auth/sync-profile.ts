import type { SupabaseClient } from '@supabase/supabase-js';

import type { Goal, NutritionPlan } from '../nutrition-calc';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/store/profile-store';
import { useProfileStore } from '@/store/profile-store';
import type { DbProfileRow } from './types';

export function mapLocalProfileToDb(
  profile: Profile,
  targets: NutritionPlan,
  userId: string,
  now: Date = new Date(),
): DbProfileRow {
  const birthYear = now.getFullYear() - profile.age;
  return {
    id: userId,
    gender: profile.gender,
    birth_year: birthYear,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    goal: profile.goal,
    training_days: profile.trainingDaysPerWeek,
    body_fat_pct: profile.bodyFatPercent ?? null,
    target_kcal: targets.calories,
    target_protein_g: targets.proteinG,
    target_carbs_g: targets.carbsG,
    target_fat_g: targets.fatG,
    target_bmr_kcal: targets.bmr,
    target_tdee_kcal: targets.tdee,
  };
}

export function mapDbProfileToLocal(
  row: DbProfileRow,
  now: Date = new Date(),
): { profile: Profile; targets: NutritionPlan } {
  const age = Math.max(18, now.getFullYear() - row.birth_year);
  const goal: Goal = row.goal;

  const profile: Profile = {
    gender: row.gender,
    age,
    heightCm: Number(row.height_cm),
    weightKg: Number(row.weight_kg),
    bodyFatPercent: row.body_fat_pct !== null ? Number(row.body_fat_pct) : undefined,
    trainingDaysPerWeek: row.training_days,
    goal,
  };

  const targets: NutritionPlan = {
    bmr: row.target_bmr_kcal ?? 0,
    tdee: row.target_tdee_kcal ?? 0,
    bmrFormula: row.body_fat_pct === null ? 'mifflin-st-jeor' : 'katch-mcardle',
    calories: Number(row.target_kcal),
    proteinG: Number(row.target_protein_g),
    carbsG: Number(row.target_carbs_g),
    fatG: Number(row.target_fat_g),
    warnings: [],
  };

  return { profile, targets };
}

export async function syncProfileToSupabase(
  profile: Profile,
  targets: NutritionPlan,
  userId: string,
  client: SupabaseClient = supabase,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const row = mapLocalProfileToDb(profile, targets, userId);
    const { error } = await client.from('profiles').upsert(row);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown synchronization error',
    };
  }
}

export async function syncProfileAndUpdatePending(
  profile: Profile,
  targets: NutritionPlan,
  userId: string,
  client: SupabaseClient = supabase,
): Promise<{ ok: boolean; error?: string }> {
  const result = await syncProfileToSupabase(profile, targets, userId, client);
  useProfileStore.getState().setPendingSync(!result.ok, userId);
  return result;
}

export async function fetchProfileFromSupabase(
  userId: string,
  client: SupabaseClient = supabase,
): Promise<{ ok: boolean; data?: { profile: Profile; targets: NutritionPlan }; error?: string }> {
  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data) {
      return { ok: true, data: undefined };
    }

    const local = mapDbProfileToLocal(data as DbProfileRow);
    return { ok: true, data: local };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown profile fetch error',
    };
  }
}
