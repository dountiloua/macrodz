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

type ProfileState = {
  hydrated: boolean;
  profile: Profile | null;
  targets: NutritionPlan | null;
  saveProfile: (profile: Profile, targets: NutritionPlan) => void;
  resetProfile: () => void;
  markHydrated: () => void;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      hydrated: false,
      profile: null,
      targets: null,
      saveProfile: (profile, targets) => set({ profile, targets }),
      resetProfile: () => set({ profile: null, targets: null }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'macro-dz-profile',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ profile: state.profile, targets: state.targets }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          useProfileStore.setState({ hydrated: true });
          return;
        }

        state?.markHydrated();
      },
    },
  ),
);
