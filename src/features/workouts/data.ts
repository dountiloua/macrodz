import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

import type {
  Workout,
  WorkoutSet,
  WorkoutSetEditValues,
  WorkoutSetValues,
  WorkoutValues,
} from './types';
import { buildWorkoutCopy, renumberWorkoutSets } from './volume';
import {
  isValidWorkoutDate,
  isValidWorkoutSetEditValues,
  isValidWorkoutSetValues,
  isValidWorkoutValues,
} from './validation';

export class WorkoutDataError extends Error {
  constructor() {
    super('Workout data operation failed');
    this.name = 'WorkoutDataError';
  }
}

function fail(error: unknown): never {
  console.error('Workout data operation failed.', error);
  throw new WorkoutDataError();
}

export async function listWorkouts(
  userId: string,
  client: SupabaseClient = supabase,
): Promise<Workout[]> {
  try {
    const { data, error } = await client
      .from('workouts')
      .select('*, workout_sets(*)')
      .eq('user_id', userId)
      .order('workout_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return fail(error);
    return (data ?? []) as Workout[];
  } catch (error) {
    if (error instanceof WorkoutDataError) throw error;
    return fail(error);
  }
}

export async function createWorkout(
  values: WorkoutValues,
  client: SupabaseClient = supabase,
): Promise<Workout> {
  if (!isValidWorkoutValues(values)) return fail(new Error('Invalid workout values'));

  try {
    const { data, error } = await client
      .from('workouts')
      .insert({
        ...values,
        name: values.name.trim(),
        notes: values.notes?.trim() || null,
      })
      .select('*, workout_sets(*)')
      .single();

    if (error || data === null) {
      return fail(error ?? new Error('Empty workout insert result'));
    }

    return { ...(data as Workout), workout_sets: (data.workout_sets ?? []) as WorkoutSet[] };
  } catch (error) {
    if (error instanceof WorkoutDataError) throw error;
    return fail(error);
  }
}

export async function addWorkoutSet(
  values: WorkoutSetValues,
  client: SupabaseClient = supabase,
): Promise<WorkoutSet> {
  if (!isValidWorkoutSetValues(values)) return fail(new Error('Invalid workout set values'));

  try {
    const { data, error } = await client
      .from('workout_sets')
      .insert({ ...values, exercise: values.exercise.trim() })
      .select('*')
      .single();

    if (error || data === null) {
      return fail(error ?? new Error('Empty workout set insert result'));
    }

    return data as WorkoutSet;
  } catch (error) {
    if (error instanceof WorkoutDataError) throw error;
    return fail(error);
  }
}

export async function updateWorkoutSet(
  userId: string,
  workoutId: string,
  setId: string,
  values: WorkoutSetEditValues,
  client: SupabaseClient = supabase,
): Promise<WorkoutSet> {
  if (!userId || !workoutId || !setId || !isValidWorkoutSetEditValues(values)) {
    return fail(new Error('Invalid workout set values'));
  }

  try {
    const { data, error } = await client
      .from('workout_sets')
      .update({ ...values, exercise: values.exercise.trim() })
      .eq('id', setId)
      .eq('workout_id', workoutId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || data === null) {
      return fail(error ?? new Error('Empty workout set update result'));
    }

    return data as WorkoutSet;
  } catch (error) {
    if (error instanceof WorkoutDataError) throw error;
    return fail(error);
  }
}

export async function deleteWorkoutSet(
  userId: string,
  workoutId: string,
  setId: string,
  client: SupabaseClient = supabase,
): Promise<void> {
  if (!userId || !workoutId || !setId) {
    return fail(new Error('Invalid workout set identifiers'));
  }

  try {
    const { data: target, error: targetError } = await client
      .from('workout_sets')
      .select('exercise')
      .eq('id', setId)
      .eq('workout_id', workoutId)
      .eq('user_id', userId)
      .single();
    if (targetError || target === null) {
      return fail(targetError ?? new Error('Workout set not found'));
    }

    const { error: deleteError } = await client
      .from('workout_sets')
      .delete()
      .eq('id', setId)
      .eq('workout_id', workoutId)
      .eq('user_id', userId);
    if (deleteError) return fail(deleteError);

    const { data: remaining, error: listError } = await client
      .from('workout_sets')
      .select('id,set_number')
      .eq('workout_id', workoutId)
      .eq('user_id', userId)
      .eq('exercise', target.exercise)
      .order('set_number', { ascending: true });
    if (listError) return fail(listError);

    for (const set of renumberWorkoutSets(remaining ?? [])) {
      const current = remaining?.find((item) => item.id === set.id);
      if (current?.set_number === set.set_number) continue;

      const { error } = await client
        .from('workout_sets')
        .update({ set_number: set.set_number })
        .eq('id', set.id)
        .eq('workout_id', workoutId)
        .eq('user_id', userId);
      if (error) return fail(error);
    }
  } catch (error) {
    if (error instanceof WorkoutDataError) throw error;
    return fail(error);
  }
}

export async function deleteWorkout(
  userId: string,
  workoutId: string,
  client: SupabaseClient = supabase,
): Promise<void> {
  if (!userId || !workoutId) return fail(new Error('Invalid workout identifiers'));

  try {
    const { error } = await client
      .from('workouts')
      .delete()
      .eq('id', workoutId)
      .eq('user_id', userId);
    if (error) return fail(error);
  } catch (error) {
    if (error instanceof WorkoutDataError) throw error;
    return fail(error);
  }
}

export async function copyWorkout(
  source: Workout,
  userId: string,
  workoutDate: string,
  client: SupabaseClient = supabase,
): Promise<Workout> {
  if (!userId || !isValidWorkoutDate(workoutDate)) {
    return fail(new Error('Invalid workout copy values'));
  }

  const copy = buildWorkoutCopy(source, userId, workoutDate);
  const created = await createWorkout(copy.workout, client);
  if (copy.sets.length === 0) return created;

  try {
    const { data, error } = await client
      .from('workout_sets')
      .insert(copy.sets.map((set) => ({ ...set, workout_id: created.id })))
      .select('*');
    if (error) return fail(error);

    return { ...created, workout_sets: (data ?? []) as WorkoutSet[] };
  } catch (error) {
    try {
      await deleteWorkout(userId, created.id, client);
    } catch (rollbackError) {
      console.error('Unable to roll back an incomplete workout copy.', rollbackError);
    }
    if (error instanceof WorkoutDataError) throw error;
    return fail(error);
  }
}
