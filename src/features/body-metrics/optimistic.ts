import type { QueryClient, QueryKey } from '@tanstack/react-query';

import type { BodyMetric } from './types';

export async function runOptimisticBodyMetricMutation<Result>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  update: (entries: BodyMetric[]) => BodyMetric[],
  operation: () => Promise<Result>,
): Promise<Result> {
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData<BodyMetric[]>(queryKey);
  queryClient.setQueryData<BodyMetric[]>(queryKey, update(previous ?? []));

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
