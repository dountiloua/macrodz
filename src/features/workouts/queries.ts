import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addWorkoutSet,
  copyWorkout,
  createWorkout,
  deleteWorkout,
  deleteWorkoutSet,
  listWorkouts,
  updateWorkoutSet,
} from './data';
import { runOptimisticWorkoutMutation } from './optimistic';
import { renumberSetsByExercise } from './volume';
import type { Workout, WorkoutSetEditValues, WorkoutSetValues, WorkoutValues } from './types';

export const workoutsQueryKey = (userId: string) => ['workouts', userId] as const;

export function useWorkouts(userId: string | undefined) {
  return useQuery({
    queryKey: workoutsQueryKey(userId ?? ''),
    queryFn: () => listWorkouts(userId!),
    enabled: Boolean(userId),
  });
}

export function useWorkoutMutations(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = workoutsQueryKey(userId);

  const create = useMutation({
    mutationFn: (values: Omit<WorkoutValues, 'user_id'>) =>
      createWorkout({ ...values, user_id: userId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const addSet = useMutation({
    mutationFn: (values: Omit<WorkoutSetValues, 'user_id'>) =>
      addWorkoutSet({ ...values, user_id: userId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const copy = useMutation({
    mutationFn: ({ source, workoutDate }: { source: Workout; workoutDate: string }) =>
      copyWorkout(source, userId, workoutDate),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const editSet = useMutation({
    mutationFn: ({
      workoutId,
      setId,
      values,
    }: {
      workoutId: string;
      setId: string;
      values: WorkoutSetEditValues;
    }) => updateWorkoutSet(userId, workoutId, setId, values),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeSet = useMutation({
    mutationFn: ({ workoutId, setId }: { workoutId: string; setId: string }) =>
      runOptimisticWorkoutMutation(
        queryClient,
        queryKey,
        (workouts) =>
          workouts.map((workout) =>
            workout.id === workoutId
              ? {
                  ...workout,
                  workout_sets: renumberSetsByExercise(
                    workout.workout_sets.filter((set) => set.id !== setId),
                  ),
                }
              : workout,
          ),
        () => deleteWorkoutSet(userId, workoutId, setId),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeWorkout = useMutation({
    mutationFn: (workoutId: string) =>
      runOptimisticWorkoutMutation(
        queryClient,
        queryKey,
        (workouts) => workouts.filter((workout) => workout.id !== workoutId),
        () => deleteWorkout(userId, workoutId),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { create, addSet, copy, editSet, removeSet, removeWorkout };
}
