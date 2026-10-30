import { QueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, jest } from '@jest/globals';

import {
  addDiaryEntry,
  createDiaryEntryValues,
  deleteDiaryEntry,
  findProductIdByBarcode,
  insertUserProduct,
  listDiaryEntries,
  updateDiaryEntry,
} from '../data';
import { shiftLocalDate, toLocalDateString } from '../date';
import { diaryQueryKey } from '../queries';
import { runOptimisticDiaryMutation } from '../optimistic';
import { sumDiaryTotals } from '../totals';
import {
  formatDiaryEntryMacros,
  getDefaultLogAmount,
  getNutritionPer100g,
  hasUsableNutrition,
} from '../nutrition';
import type { DiaryEntry, DiaryEntryValues } from '../types';
import { convertServing } from '../../serving-units';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const row: DiaryEntry = {
  id: 'entry-1',
  user_id: 'user-1',
  product_id: null,
  product_name: 'Khobz',
  log_date: '2026-10-28',
  meal: 'breakfast',
  quantity: 100,
  unit: 'g',
  grams: 100,
  kcal: 270,
  protein: 8.5,
  carbs: 54,
  fat: 1.5,
  created_at: '2026-10-28T07:00:00.000Z',
};

function mockClient(response: { data?: unknown; error?: { message: string } | null } = {}) {
  const resolved = {
    data: 'data' in response ? response.data : row,
    error: response.error ?? null,
  };
  const builder: Record<string, jest.Mock> & { then?: unknown } = {} as Record<string, jest.Mock>;
  for (const method of ['select', 'eq', 'order', 'insert', 'update', 'delete']) {
    builder[method] = jest.fn(() => builder);
  }
  builder.single = jest.fn(async () => resolved);
  builder.then = (resolve: (value: typeof resolved) => unknown) =>
    Promise.resolve(resolved).then(resolve);
  const client = {
    from: jest.fn(() => builder),
  } as unknown as SupabaseClient;
  return { client, builder };
}

describe('diary calculations', () => {
  it('exposes complete per-100g nutrition and rejects missing or all-zero nutrition', () => {
    expect(getNutritionPer100g({ kcal: 200, protein: 10, carbs: 20, fat: 5 })).toEqual({
      kcal: 200,
      protein: 10,
      carbs: 20,
      fat: 5,
    });
    expect(hasUsableNutrition({ kcal: 100, protein: 0, carbs: 0, fat: 0 })).toBe(true);
    expect(hasUsableNutrition({ kcal: 0, protein: 0, carbs: 0, fat: 0 })).toBe(false);
    expect(hasUsableNutrition({ kcal: 100, protein: 4, carbs: 2 })).toBe(false);
  });

  it('defaults logs to one known serving or 100 grams and preserves snapshot macros', () => {
    expect(getDefaultLogAmount(50)).toEqual({ quantity: '1', unit: 'unit' });
    expect(getDefaultLogAmount()).toEqual({ quantity: '100', unit: 'g' });
    expect(getDefaultLogAmount(50, '2', 'unit')).toEqual({ quantity: '2', unit: 'unit' });
    expect(
      formatDiaryEntryMacros(row, {
        protein: 'Protein',
        carbs: 'Carbs',
        fat: 'Fat',
        unit: 'g',
      }),
    ).toBe('Protein 8.5 g · Carbs 54 g · Fat 1.5 g');
    const food = { kcal: 200, protein: 10, carbs: 20, fat: 5, servingQuantityG: 50 };
    const initial = getDefaultLogAmount(food.servingQuantityG);
    expect(convertServing(food, Number(initial.quantity), initial.unit)).toEqual({
      ok: true,
      grams: 50,
      kcal: 100,
      protein: 5,
      carbs: 10,
      fat: 2.5,
    });
  });

  it('sums calories and macros', () => {
    expect(sumDiaryTotals([row, { ...row, kcal: 80, protein: 4, carbs: 10, fat: 2 }])).toEqual({
      kcal: 350,
      protein: 12.5,
      carbs: 64,
      fat: 3.5,
    });
  });

  it('uses local calendar fields around midnight and shifts local dates', () => {
    expect(toLocalDateString(new Date(2026, 9, 27, 23, 59))).toBe('2026-10-27');
    expect(toLocalDateString(new Date(2026, 9, 28, 0, 1))).toBe('2026-10-28');
    expect(shiftLocalDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftLocalDate('2026-11-01', -1)).toBe('2026-10-31');
  });

  it('scales nutrition by grams and serving units through serving conversion', () => {
    const food = {
      name: 'Test food',
      kcal: 200,
      protein: 10,
      carbs: 20,
      fat: 5,
      servingQuantityG: 50,
    };
    const byGrams = createDiaryEntryValues({
      userId: 'user-1',
      date: '2026-10-28',
      meal: 'lunch',
      food,
      quantity: 150,
      unit: 'g',
    });
    const byUnit = createDiaryEntryValues({
      userId: 'user-1',
      date: '2026-10-28',
      meal: 'lunch',
      food,
      quantity: 2,
      unit: 'unit',
    });

    expect(byGrams).toMatchObject({ grams: 150, kcal: 300, protein: 15, carbs: 30, fat: 7.5 });
    expect(byUnit).toMatchObject({ grams: 100, kcal: 200, protein: 10, carbs: 20, fat: 5 });
  });

  it('rejects diary values outside food_logs database constraints', () => {
    const food = { name: 'Test food', kcal: 200, protein: 10, carbs: 20, fat: 5 };
    expect(() =>
      createDiaryEntryValues({
        userId: 'user-1',
        date: '2026-10-28',
        meal: 'dinner',
        food,
        quantity: 0,
        unit: 'g',
      }),
    ).toThrow();
    expect(() =>
      createDiaryEntryValues({
        userId: 'user-1',
        date: '2026-10-28',
        meal: 'dinner',
        food,
        quantity: 10_001,
        unit: 'g',
      }),
    ).toThrow();
    expect(() =>
      createDiaryEntryValues({
        userId: 'user-1',
        date: '2026-02-30',
        meal: 'dinner',
        food,
        quantity: 100,
        unit: 'g',
      }),
    ).toThrow();
  });
});

describe('diary Supabase data functions', () => {
  it('lists entries filtered by user and local date', async () => {
    const { client, builder } = mockClient({ data: [row] });
    await expect(listDiaryEntries('user-1', '2026-10-28', client)).resolves.toEqual([row]);
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'log_date', '2026-10-28');
  });

  it('adds and edits entries', async () => {
    const { client: addClient, builder: addBuilder } = mockClient({ data: row });
    const values: DiaryEntryValues = {
      user_id: row.user_id,
      product_id: null,
      product_name: row.product_name,
      log_date: row.log_date,
      meal: row.meal,
      quantity: row.quantity,
      unit: row.unit,
      grams: row.grams,
      kcal: row.kcal,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
    };
    await expect(addDiaryEntry(values, addClient)).resolves.toEqual(row);
    expect(addBuilder.insert).toHaveBeenCalledWith(values);

    const { client: updateClient, builder: updateBuilder } = mockClient({ data: row });
    const changes = {
      quantity: 150,
      unit: 'g' as const,
      grams: 150,
      kcal: 405,
      protein: 12.8,
      carbs: 81,
      fat: 2.3,
    };
    await expect(updateDiaryEntry('user-1', row.id, changes, updateClient)).resolves.toEqual(row);
    expect(updateBuilder.update).toHaveBeenCalledWith(changes);
    expect(updateBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('deletes only the signed-in user entry', async () => {
    const { client, builder } = mockClient({ data: null });
    await expect(deleteDiaryEntry('user-1', row.id, client)).resolves.toBeUndefined();
    expect(builder.eq).toHaveBeenCalledWith('id', row.id);
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('inserts a private unverified user product attributed to its creator', async () => {
    const { client, builder } = mockClient({ data: { id: 'product-1' } });
    await expect(
      insertUserProduct(
        'user-1',
        { barcode: '6131234567890', name: 'Manual food', kcal: 100, protein: 5, carbs: 10, fat: 2 },
        client,
      ),
    ).resolves.toBe('product-1');
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'user',
        verified: false,
        created_by: 'user-1',
      }),
    );
  });

  it('finds an existing visible product id by barcode', async () => {
    const { client, builder } = mockClient({ data: { id: 'off-product-1' } });
    builder.maybeSingle = jest.fn(async () => ({ data: { id: 'off-product-1' }, error: null }));
    await expect(findProductIdByBarcode('6131234567890', client)).resolves.toBe('off-product-1');
    expect(builder.eq).toHaveBeenCalledWith('barcode', '6131234567890');
  });

  it('restores the prior query data after an optimistic operation fails', async () => {
    const queryClient = new QueryClient();
    const queryKey = diaryQueryKey('user-1', row.log_date);
    queryClient.setQueryData(queryKey, [row]);

    await expect(
      runOptimisticDiaryMutation(
        queryClient,
        queryKey,
        (entries) => entries.filter((entry) => entry.id !== row.id),
        async () => {
          throw new Error('test failure');
        },
      ),
    ).rejects.toThrow('test failure');

    expect(queryClient.getQueryData(queryKey)).toEqual([row]);
    queryClient.clear();
  });
});
