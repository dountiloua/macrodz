import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Gender, Goal, NutritionPlan } from '@/features/nutrition-calc';

export type Profile = {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercent?: number;
  trainingDaysPerWeek: number;
  goal: Goal;
};

type StoredProfile = {
  profile: Profile;
  targets: NutritionPlan;
  pendingSync: boolean;
};

type ProfileState = {
  hydrated: boolean;
  userId: string | null;
  profile: Profile | null;
  targets: NutritionPlan | null;
  pendingSync: boolean;
  profilesByUserId: Record<string, StoredProfile>;
  setUserId: (userId: string | null) => void;
  saveProfile: (
    profile: Profile,
    targets: NutritionPlan,
    userId: string,
    pendingSync?: boolean,
  ) => void;
  setPendingSync: (pendingSync: boolean, userId?: string) => void;
  resetProfile: () => void;
  finishSignOut: (userId: string | null) => void;
  markHydrated: () => void;
};

let resolveHydration: () => void = () => {};
const hydrationComplete = new Promise<void>((resolve) => {
  resolveHydration = resolve;
});

export function waitForProfileHydration(): Promise<void> {
  if (useProfileStore.getState().hydrated) {
    return Promise.resolve();
  }

  return hydrationComplete;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      userId: null,
      profile: null,
      targets: null,
      pendingSync: false,
      profilesByUserId: {},
      setUserId: (userId) => {
        const stored = userId ? get().profilesByUserId[userId] : undefined;
        set({
          userId,
          profile: stored?.profile ?? null,
          targets: stored?.targets ?? null,
          pendingSync: stored?.pendingSync ?? false,
        });
      },
      saveProfile: (profile, targets, userId, pendingSync = false) => {
        const storedProfile = { profile, targets, pendingSync };
        set((state) => ({
          userId,
          profile,
          targets,
          pendingSync,
          profilesByUserId: {
            ...state.profilesByUserId,
            [userId]: storedProfile,
          },
        }));
      },
      setPendingSync: (pendingSync, userId) => {
        const state = get();
        const targetUserId = userId ?? state.userId;
        if (!targetUserId) {
          return;
        }

        const stored = state.profilesByUserId[targetUserId];
        if (!stored) {
          return;
        }

        const updated = { ...stored, pendingSync };
        set({
          profilesByUserId: {
            ...state.profilesByUserId,
            [targetUserId]: updated,
          },
          ...(state.userId === targetUserId ? { pendingSync } : {}),
        });
      },
      resetProfile: () => {
        set({
          userId: null,
          profile: null,
          targets: null,
          pendingSync: false,
          profilesByUserId: {},
        });
      },
      finishSignOut: (userId) => {
        const pendingProfile =
          userId && get().profilesByUserId[userId]?.pendingSync
            ? get().profilesByUserId[userId]
            : undefined;
        set({
          userId: null,
          profile: null,
          targets: null,
          pendingSync: false,
          profilesByUserId: userId && pendingProfile ? { [userId]: pendingProfile } : {},
        });
      },
      markHydrated: () => {
        set({ hydrated: true });
        resolveHydration();
      },
    }),
    {
      name: 'macro-dz-profile',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ profilesByUserId: state.profilesByUserId }),
      migrate: () => ({ profilesByUserId: {} }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('Unable to hydrate the persisted profile store.', error);
          useProfileStore.getState().markHydrated();
          return;
        }

        (state ?? useProfileStore.getState()).markHydrated();
      },
    },
  ),
);
