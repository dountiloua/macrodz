import type { QueryClient, QueryKey } from '@tanstack/react-query';

import type { Workout } from './types';

export async function runOptimisticWorkoutMutation<Result>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  update: (workouts: Workout[]) => Workout[],
  operation: () => Promise<Result>,
): Promise<Result> {
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData<Workout[]>(queryKey);
  queryClient.setQueryData<Workout[]>(queryKey, update(previous ?? []));

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
