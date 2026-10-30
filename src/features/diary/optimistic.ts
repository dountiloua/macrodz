import type { QueryClient, QueryKey } from '@tanstack/react-query';

import type { DiaryEntry } from './types';

export async function runOptimisticDiaryMutation<Result>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  update: (entries: DiaryEntry[]) => DiaryEntry[],
  operation: () => Promise<Result>,
): Promise<Result> {
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData<DiaryEntry[]>(queryKey);
  queryClient.setQueryData<DiaryEntry[]>(queryKey, update(previous ?? []));

  try {
    return await operation();
  } catch (error) {
    if (previous === undefined) {
      queryClient.removeQueries({ queryKey, exact: true });
    } else {
      queryClient.setQueryData(queryKey, previous);
    }
    throw error;
  }
}
