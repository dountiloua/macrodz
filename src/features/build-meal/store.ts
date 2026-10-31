import { createStore } from 'zustand/vanilla';

import { convertServing } from '@/features/serving-units';

import type { BuildMealItem, BuildMealTotals } from './types';

export const MAX_BUILD_MEAL_ITEMS = 15;

export type AddBuildMealResult = 'added' | 'duplicate' | 'limit';

type BuildMealState = {
  items: BuildMealItem[];
  addItem: (item: BuildMealItem) => AddBuildMealResult;
  updateItem: (itemId: string, updates: Pick<BuildMealItem, 'quantity' | 'unit'>) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
  totals: () => BuildMealTotals;
};

export function createBuildMealStore() {
  return createStore<BuildMealState>((set, get) => ({
    items: [],
    addItem: (item) => {
      const currentItems = get().items;
      if (currentItems.length >= MAX_BUILD_MEAL_ITEMS) return 'limit';
      const duplicate =
        item.barcode !== undefined &&
        currentItems.some((current) => current.barcode === item.barcode);
      set({ items: [...currentItems, item] });
      return duplicate ? 'duplicate' : 'added';
    },
    updateItem: (itemId, updates) =>
      set((state) => ({
        items: state.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
      })),
    removeItem: (itemId) =>
      set((state) => ({ items: state.items.filter((item) => item.id !== itemId) })),
    clear: () => set({ items: [] }),
    totals: () =>
      get().items.reduce<BuildMealTotals>(
        (totals, item) => {
          const conversion = convertServing(item, item.quantity, item.unit);
          if (!conversion.ok) return totals;
          return {
            kcal: totals.kcal + conversion.kcal,
            protein: totals.protein + conversion.protein,
            carbs: totals.carbs + conversion.carbs,
            fat: totals.fat + conversion.fat,
          };
        },
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ),
  }));
}

export const buildMealStore = createBuildMealStore();
