import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { NutritionPlan } from '../../nutrition-calc';
import type { Profile } from '@/store/profile-store';
import {
  fetchProfileFromSupabase,
  mapDbProfileToLocal,
  mapLocalProfileToDb,
  syncProfileToSupabase,
} from '../sync-profile';
import type { DbProfileRow } from '../types';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

describe('syncProfile', () => {
  const fixedDate = new Date(2026, 0, 1); // 2026

  const localProfile: Profile = {
    gender: 'male',
    age: 26,
    heightCm: 178,
    weightKg: 75,
    bodyFatPercent: 15,
    trainingDaysPerWeek: 4,
    goal: 'lean_bulk',
  };

  const localTargets: NutritionPlan = {
    bmr: 1720,
    tdee: 2666,
    bmrFormula: 'katch-mcardle',
    calories: 2933,
    proteinG: 150,
    carbsG: 418,
    fatG: 60,
    warnings: [],
  };

  const userId = '11111111-2222-3333-4444-555555555555';

  it('maps local profile and targets to database row format', () => {
    const dbRow = mapLocalProfileToDb(localProfile, localTargets, userId, fixedDate);

    expect(dbRow).toEqual({
      id: userId,
      gender: 'male',
      birth_year: 2000,
      height_cm: 178,
      weight_kg: 75,
      goal: 'lean_bulk',
      training_days: 4,
      body_fat_pct: 15,
      target_kcal: 2933,
      target_protein_g: 150,
      target_carbs_g: 418,
      target_fat_g: 60,
      target_bmr_kcal: 1720,
      target_tdee_kcal: 2666,
    });
  });

  it('maps database row format back to local profile and targets', () => {
    const dbRow: DbProfileRow = {
      id: userId,
      gender: 'female',
      birth_year: 1996,
      height_cm: 165,
      weight_kg: 60,
      goal: 'cut',
      training_days: 3,
      body_fat_pct: null,
      target_kcal: 1600,
      target_protein_g: 132,
      target_carbs_g: 148,
      target_fat_g: 48,
      target_bmr_kcal: 1350,
      target_tdee_kcal: 1850,
    };

    const { profile, targets } = mapDbProfileToLocal(dbRow, fixedDate);

    expect(profile).toEqual({
      gender: 'female',
      age: 30,
      heightCm: 165,
      weightKg: 60,
      bodyFatPercent: undefined,
      trainingDaysPerWeek: 3,
      goal: 'cut',
    });

    expect(targets).toEqual({
      bmr: 1350,
      tdee: 1850,
      bmrFormula: 'mifflin-st-jeor',
      calories: 1600,
      proteinG: 132,
      carbsG: 148,
      fatG: 48,
      warnings: [],
    });
  });

  it('syncs profile to supabase via upsert', async () => {
    let upsertedRow: unknown = null;
    const mockClient = {
      from: (table: string) => ({
        upsert: async (row: unknown) => {
          upsertedRow = row;
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient;

    const result = await syncProfileToSupabase(localProfile, localTargets, userId, mockClient);
    expect(result.ok).toBe(true);
    expect(upsertedRow).toMatchObject({
      id: userId,
      gender: 'male',
      target_kcal: 2933,
    });
  });

  it('fetches profile from supabase when present', async () => {
    const dbRow: DbProfileRow = {
      id: userId,
      gender: 'male',
      birth_year: 2000,
      height_cm: 178,
      weight_kg: 75,
      goal: 'maintain',
      training_days: 4,
      body_fat_pct: 15,
      target_kcal: 2500,
      target_protein_g: 150,
      target_carbs_g: 300,
      target_fat_g: 60,
      target_bmr_kcal: 1700,
      target_tdee_kcal: 2500,
    };

    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: dbRow, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await fetchProfileFromSupabase(userId, mockClient);
    expect(result.ok).toBe(true);
    expect(result.data?.profile.gender).toBe('male');
    expect(result.data?.targets.calories).toBe(2500);
  });
});
