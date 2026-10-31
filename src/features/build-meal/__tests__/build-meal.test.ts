import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, jest } from '@jest/globals';

import type { BuildMealItem } from '../types';
import { saveBuildMealAndClear } from '../data';
import { createBuildMealStore, MAX_BUILD_MEAL_ITEMS } from '../store';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

function createItem(index = 1, overrides: Partial<BuildMealItem> = {}): BuildMealItem {
  return {
    id: `item-${index}`,
    name: `Food ${index}`,
    kind: 'solid',
    kcal: 200,
    protein: 10,
    carbs: 20,
    fat: 5,
    quantity: 100,
    unit: 'g',
    barcode: `00000000000${index}`,
    ...overrides,
  };
}

function createClient(error: { message: string } | null = null) {
  const insert = jest.fn(async (_rows: unknown) => ({ error }));
  const client = {
    from: jest.fn(() => ({ insert })),
  } as unknown as SupabaseClient;
  return { client, insert };
}

describe('build meal basket store', () => {
  it('adds products and identifies a repeated barcode for duplicate handling', () => {
    const store = createBuildMealStore();
    expect(store.getState().addItem(createItem())).toBe('added');
    expect(
      store.getState().addItem(createItem(2, { id: 'item-2', barcode: '000000000001' })),
    ).toBe('duplicate');
    expect(store.getState().items).toHaveLength(2);
  });

  it('edits and removes items and recalculates totals', () => {
    const store = createBuildMealStore();
    store.getState().addItem(createItem());
    store.getState().addItem(createItem(2, { id: 'item-2', barcode: undefined }));
    store.getState().updateItem('item-1', { quantity: 200, unit: 'g' });

    expect(store.getState().totals()).toEqual({
      kcal: 600,
      protein: 30,
      carbs: 60,
      fat: 15,
    });

    store.getState().removeItem('item-1');
    expect(store.getState().items.map((item) => item.id)).toEqual(['item-2']);
    expect(store.getState().totals()).toEqual({
      kcal: 200,
      protein: 10,
      carbs: 20,
      fat: 5,
    });
  });

  it('enforces the 15 item maximum', () => {
    const store = createBuildMealStore();
    for (let index = 0; index < MAX_BUILD_MEAL_ITEMS; index += 1) {
      expect(store.getState().addItem(createItem(index, { barcode: undefined }))).toBe('added');
    }

    expect(store.getState().items).toHaveLength(15);
    expect(store.getState().addItem(createItem(16, { barcode: undefined }))).toBe('limit');
    expect(store.getState().items).toHaveLength(15);
  });
});

describe('saveBuildMealAndClear', () => {
  it('batch-inserts client ids and diary snapshots, then clears on success', async () => {
    const store = createBuildMealStore();
    store.getState().addItem(createItem());
    store.getState().addItem(createItem(2, { id: 'item-2', barcode: undefined }));
    const { client, insert } = createClient();
    const ids = ['uuid-1', 'uuid-2'];
    const createId = jest.fn(() => ids.shift() ?? 'unused');

    await saveBuildMealAndClear(
      { userId: 'user-42', date: '2026-10-31', meal: 'dinner' },
      store,
      client,
      createId,
    );

    expect(client.from).toHaveBeenCalledWith('food_logs');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'uuid-1',
        user_id: 'user-42',
        product_id: null,
        product_name: 'Food 1',
        log_date: '2026-10-31',
        meal: 'dinner',
        quantity: 100,
        unit: 'g',
        grams: 100,
        kcal: 200,
        protein: 10,
        carbs: 20,
        fat: 5,
      }),
      expect.objectContaining({
        id: 'uuid-2',
        user_id: 'user-42',
        product_name: 'Food 2',
        log_date: '2026-10-31',
        meal: 'dinner',
      }),
    ]);
    expect(store.getState().items).toEqual([]);
  });

  it('keeps the basket intact when the atomic batch insert fails', async () => {
    const store = createBuildMealStore();
    store.getState().addItem(createItem());
    const { client } = createClient({ message: 'database details must not reach the UI' });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      saveBuildMealAndClear(
        { userId: 'user-42', date: '2026-10-31', meal: 'dinner' },
        store,
        client,
        () => 'uuid-1',
      ),
    ).rejects.toThrow('Diary data operation failed');

    expect(store.getState().items).toHaveLength(1);
    consoleError.mockRestore();
  });
});
