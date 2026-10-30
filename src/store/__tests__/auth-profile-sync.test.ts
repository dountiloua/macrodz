import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { syncProfileAndUpdatePending } from '@/features/auth/sync-profile';
import { useAuthStore } from '@/store/auth-store';
import { useProfileStore, waitForProfileHydration } from '@/store/profile-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockSupabaseAuth = supabase.auth as unknown as {
  getSession: jest.Mock;
  onAuthStateChange: jest.Mock;
  signInWithPassword: jest.Mock;
  signOut: jest.Mock;
};
const mockSupabaseFrom = supabase.from as unknown as jest.Mock;

const userId = '11111111-2222-3333-4444-555555555555';
const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4_000_000_000,
  user: {
    id: userId,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
  },
} as Session;

const profile = {
  gender: 'male' as const,
  age: 26,
  heightCm: 178,
  weightKg: 75,
  bodyFatPercent: 15,
  trainingDaysPerWeek: 4,
  goal: 'lean_bulk' as const,
};

const targets = {
  bmr: 1720,
  tdee: 2666,
  bmrFormula: 'katch-mcardle' as const,
  calories: 2933,
  proteinG: 150,
  carbsG: 418,
  fatG: 60,
  warnings: [],
};

const dbProfile = {
  id: userId,
  gender: 'male',
  birth_year: new Date().getFullYear() - 26,
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
};

describe('authenticated profile sync lifecycle', () => {
  beforeEach(async () => {
    await waitForProfileHydration();
    useProfileStore.getState().resetProfile();
    useAuthStore.setState({ initialized: false, session: null, user: null });
    mockSupabaseFrom.mockReset();
    mockSupabaseAuth.getSession.mockReset();
    mockSupabaseAuth.onAuthStateChange.mockReset();
    mockSupabaseAuth.signInWithPassword.mockReset();
    mockSupabaseAuth.signOut.mockReset();
  });

  it('saves the local profile and marks a successful Supabase sync complete', async () => {
    const mockClient = {
      from: () => ({
        upsert: async () => ({ error: null }),
      }),
    };

    useProfileStore.getState().saveProfile(profile, targets, userId);
    const result = await syncProfileAndUpdatePending(profile, targets, userId, mockClient as never);

    expect(result.ok).toBe(true);
    expect(useProfileStore.getState()).toMatchObject({
      userId,
      profile,
      targets,
      pendingSync: false,
    });
  });

  it('retains the pending flag after failure and clears it after retry succeeds', async () => {
    let upsertCount = 0;
    const mockClient = {
      from: () => ({
        upsert: async () => {
          upsertCount += 1;
          return upsertCount === 1 ? { error: { message: 'offline' } } : { error: null };
        },
      }),
    };

    useProfileStore.getState().saveProfile(profile, targets, userId);
    const failedResult = await syncProfileAndUpdatePending(
      profile,
      targets,
      userId,
      mockClient as never,
    );
    expect(failedResult.ok).toBe(false);
    expect(useProfileStore.getState().pendingSync).toBe(true);

    const retryResult = await syncProfileAndUpdatePending(
      profile,
      targets,
      userId,
      mockClient as never,
    );
    expect(retryResult.ok).toBe(true);
    expect(useProfileStore.getState().pendingSync).toBe(false);
    expect(upsertCount).toBe(2);
  });

  it('fetches and stores the profile after sign-in when no local profile exists', async () => {
    mockSupabaseAuth.signInWithPassword.mockImplementation(
      async () =>
        ({
          data: { session, user: session.user },
          error: null,
        }) as never,
    );
    mockSupabaseFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: dbProfile, error: null }),
        }),
      }),
    }));

    const result = await useAuthStore.getState().signIn({
      email: 'person@example.com',
      password: 'password123',
    });

    expect(result.error).toBeNull();
    expect(mockSupabaseFrom).toHaveBeenCalledWith('profiles');
    expect(useProfileStore.getState().userId).toBe(userId);
    expect(useProfileStore.getState().profile).toMatchObject({
      gender: 'male',
      heightCm: 178,
      weightKg: 75,
    });
  });

  it('retries a pending profile sync when the app initializes with a session', async () => {
    useProfileStore.getState().saveProfile(profile, targets, userId, true);
    mockSupabaseAuth.getSession.mockImplementation(
      async () => ({ data: { session }, error: null }) as never,
    );
    mockSupabaseFrom.mockImplementation(() => ({
      upsert: async () => ({ error: null }),
    }));

    await useAuthStore.getState().initialize();

    expect(mockSupabaseFrom).toHaveBeenCalledWith('profiles');
    expect(useProfileStore.getState().pendingSync).toBe(false);
    expect(useAuthStore.getState().initialized).toBe(true);
  });

  it('clears the persisted profile and pending sync state on sign-out', async () => {
    useProfileStore.getState().saveProfile(profile, targets, userId, true);
    useAuthStore.setState({ session, user: session.user });
    mockSupabaseAuth.signOut.mockImplementation(async () => ({ error: null }) as never);

    await useAuthStore.getState().signOut();

    expect(useProfileStore.getState()).toMatchObject({
      userId: null,
      profile: null,
      targets: null,
      pendingSync: false,
      profilesByUserId: {},
    });
    expect(useAuthStore.getState().user).toBeNull();
  });
});
