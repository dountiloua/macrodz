import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteBodyMetric, listBodyMetrics, saveBodyMetric, updateBodyMetric } from './data';
import { runOptimisticBodyMetricMutation } from './optimistic';
import type { BodyMetric, BodyMetricValues } from './types';

export const bodyMetricsQueryKey = (userId: string) => ['body-metrics', userId] as const;

export function useBodyMetrics(userId: string | undefined) {
  return useQuery({
    queryKey: bodyMetricsQueryKey(userId ?? ''),
    queryFn: () => listBodyMetrics(userId!),
    enabled: Boolean(userId),
  });
}

export function useBodyMetricMutations(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = bodyMetricsQueryKey(userId);

  const save = useMutation({
    mutationFn: (values: Omit<BodyMetricValues, 'user_id'>) =>
      saveBodyMetric({ ...values, user_id: userId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (entryDate: string) =>
      runOptimisticBodyMetricMutation(
        queryClient,
        queryKey,
        (entries) => entries.filter((entry) => entry.entry_date !== entryDate),
        () => deleteBodyMetric(userId, entryDate),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ entryDate, values }: { entryDate: string; values: Omit<BodyMetricValues, 'user_id' | 'entry_date'> }) =>
      runOptimisticBodyMetricMutation(
        queryClient,
        queryKey,
        (entries) => entries.map((entry) => (entry.entry_date === entryDate ? { ...entry, ...values } : entry)),
        () => updateBodyMetric(userId, entryDate, values),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { save, update, remove };
}
