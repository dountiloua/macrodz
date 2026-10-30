import type { ExerciseVolume, Workout, WorkoutSet, WorkoutSetValues } from './types';

export function renumberWorkoutSets(
  sets: Pick<WorkoutSet, 'id' | 'set_number'>[],
): Pick<WorkoutSet, 'id' | 'set_number'>[] {
  return [...sets]
    .sort((left, right) => left.set_number - right.set_number)
    .map((set, index) => ({ id: set.id, set_number: index + 1 }));
}

export function renumberSetsByExercise(sets: WorkoutSet[]): WorkoutSet[] {
  const sortedSets = [...sets].sort((left, right) => {
    const exerciseOrder = left.exercise.localeCompare(right.exercise);
    return exerciseOrder || left.set_number - right.set_number;
  });
  const exerciseIndexes = new Map<string, number>();
  return sortedSets.map((set) => {
    const key = set.exercise.trim().toLocaleLowerCase();
    const nextNumber = (exerciseIndexes.get(key) ?? 0) + 1;
    exerciseIndexes.set(key, nextNumber);
    return { ...set, set_number: nextNumber };
  });
}

export function buildWorkoutCopy(
  source: Workout,
  userId: string,
  workoutDate: string,
): {
  workout: Omit<Workout, 'id' | 'created_at' | 'updated_at' | 'workout_sets'>;
  sets: Omit<WorkoutSetValues, 'workout_id'>[];
} {
  return {
    workout: {
      user_id: userId,
      workout_date: workoutDate,
      name: source.name,
      notes: null,
    },
    sets: [...source.workout_sets]
      .sort((left, right) => left.set_number - right.set_number)
      .map(({ exercise, set_number, reps, weight_kg }) => ({
        user_id: userId,
        exercise,
        set_number,
        reps,
        weight_kg,
      })),
  };
}

export function groupWorkoutSets(sets: WorkoutSet[]): ExerciseVolume[] {
  const grouped = new Map<string, ExerciseVolume>();

  for (const set of sets) {
    const key = set.exercise.trim().toLocaleLowerCase();
    const existing = grouped.get(key);
    if (existing) {
      existing.sets.push(set);
      existing.volumeKg += set.reps * set.weight_kg;
    } else {
      grouped.set(key, {
        exercise: set.exercise,
        volumeKg: set.reps * set.weight_kg,
        sets: [set],
      });
    }
  }

  return [...grouped.values()];
}

export function getWorkoutVolume(sets: WorkoutSet[]): number {
  return sets.reduce((total, set) => total + set.reps * set.weight_kg, 0);
}
