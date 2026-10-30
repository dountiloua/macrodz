import type { WorkoutSetEditValues, WorkoutSetValues, WorkoutValues } from './types';

export function isValidWorkoutDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    Number.isFinite(year) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidWorkoutValues(values: WorkoutValues): boolean {
  const name = values.name.trim();
  const notes = values.notes?.trim() ?? '';

  return (
    values.user_id.length > 0 &&
    isValidWorkoutDate(values.workout_date) &&
    name.length >= 1 &&
    name.length <= 80 &&
    notes.length <= 500
  );
}

export function isValidWorkoutSetValues(values: WorkoutSetValues): boolean {
  return (
    values.workout_id.length > 0 && values.user_id.length > 0 && isValidWorkoutSetFields(values)
  );
}

export function isValidWorkoutSetEditValues(values: WorkoutSetEditValues): boolean {
  return isValidWorkoutSetFields(values);
}

function isValidWorkoutSetFields(
  values: Pick<WorkoutSetEditValues, 'exercise' | 'set_number' | 'reps' | 'weight_kg'>,
): boolean {
  const exercise = values.exercise.trim();

  return (
    exercise.length >= 1 &&
    exercise.length <= 80 &&
    Number.isInteger(values.set_number) &&
    values.set_number >= 1 &&
    values.set_number <= 100 &&
    Number.isInteger(values.reps) &&
    values.reps >= 1 &&
    values.reps <= 1000 &&
    Number.isFinite(values.weight_kg) &&
    values.weight_kg >= 0 &&
    values.weight_kg <= 1000
  );
}
