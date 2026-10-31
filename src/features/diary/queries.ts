import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';

import {
  addDiaryEntry,
  deleteDiaryEntry,
  listDiaryEntries,
  listDiaryFoodHistory,
  updateDiaryEntry,
} from './data';
import { runOptimisticDiaryMutation } from './optimistic';
import type { DiaryEntry, DiaryEntryValues } from './types';

export const diaryQueryKey = (userId: string, date: string) => ['food-logs', userId, date] as const;
export const diaryFoodHistoryQueryKey = (userId: string, throughDate: string) =>
  ['food-log-history', userId, throughDate] as const;

export function useDiaryEntries(userId: string | undefined, date: string) {
  return useQuery({
    queryKey: diaryQueryKey(userId ?? '', date),
    queryFn: () => listDiaryEntries(userId!, date),
    enabled: Boolean(userId),
  });
}

export function useDiaryFoodHistory(userId: string | undefined, throughDate: string) {
  return useQuery({
    queryKey: diaryFoodHistoryQueryKey(userId ?? '', throughDate),
    queryFn: () => listDiaryFoodHistory(userId!, throughDate),
    enabled: Boolean(userId),
  });
}

export function useDiaryMutations(userId: string, date: string) {
  const queryClient = useQueryClient();
  const queryKey = diaryQueryKey(userId, date);

  const add = useMutation({
    mutationFn: (values: DiaryEntryValues) =>
      runOptimisticDiaryMutation(
        queryClient,
        queryKey,
        (entries) => [
          ...entries,
          { ...values, id: randomUUID(), created_at: new Date().toISOString() },
        ],
        () => addDiaryEntry(values),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['food-log-history', userId] });
    },
  });

  const update = useMutation({
    mutationFn: ({
      entryId,
      values,
    }: {
      entryId: string;
      values: Pick<
        DiaryEntry,
        'quantity' | 'unit' | 'grams' | 'kcal' | 'protein' | 'carbs' | 'fat'
      >;
    }) =>
      runOptimisticDiaryMutation(
        queryClient,
        queryKey,
        (entries) =>
          entries.map((entry) => (entry.id === entryId ? { ...entry, ...values } : entry)),
        () => updateDiaryEntry(userId, entryId, values),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['food-log-history', userId] });
    },
  });

  const remove = useMutation({
    mutationFn: (entryId: string) =>
      runOptimisticDiaryMutation(
        queryClient,
        queryKey,
        (entries) => entries.filter((entry) => entry.id !== entryId),
        () => deleteDiaryEntry(userId, entryId),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['food-log-history', userId] });
    },
  });

  return { add, update, remove };
}
