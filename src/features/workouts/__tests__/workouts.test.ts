import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from '@jest/globals';

import type { Workout, WorkoutSet } from '../types';
import {
  isValidWorkoutDate,
  isValidWorkoutSetEditValues,
  isValidWorkoutSetValues,
  isValidWorkoutValues,
} from '../validation';
import { runOptimisticWorkoutMutation } from '../optimistic';
import {
  buildWorkoutCopy,
  getWorkoutVolume,
  groupWorkoutSets,
  renumberSetsByExercise,
} from '../volume';

const set = (
  id: string,
  exercise: string,
  setNumber: number,
  reps: number,
  weightKg: number,
): WorkoutSet => ({
  id,
  workout_id: 'workout-1',
  user_id: 'user-1',
  exercise,
  set_number: setNumber,
  reps,
  weight_kg: weightKg,
  volume_kg: reps * weightKg,
  created_at: '2026-10-28T07:00:00.000Z',
});

const workout: Workout = {
  id: 'workout-1',
  user_id: 'user-1',
  workout_date: '2026-10-28',
  name: 'Upper body',
  notes: 'Original note',
  created_at: '2026-10-28T07:00:00.000Z',
  updated_at: '2026-10-28T07:00:00.000Z',
  workout_sets: [set('set-1', 'Bench press', 1, 10, 40), set('set-2', 'Bench press', 2, 8, 45)],
};

describe('workout validation', () => {
  it('accepts valid calendar dates and rejects malformed or impossible dates', () => {
    expect(isValidWorkoutDate('2026-10-28')).toBe(true);
    expect(isValidWorkoutDate('2026-02-29')).toBe(false);
    expect(isValidWorkoutDate('28-10-2026')).toBe(false);
  });

  it('validates workout values against the database limits', () => {
    expect(
      isValidWorkoutValues({
        user_id: 'user-1',
        workout_date: '2026-10-28',
        name: '  Upper body  ',
        notes: '  Good session  ',
      }),
    ).toBe(true);
    expect(
      isValidWorkoutValues({
        user_id: 'user-1',
        workout_date: '2026-10-28',
        name: ' ',
        notes: null,
      }),
    ).toBe(false);
  });

  it('validates set number, reps, weight, and exercise bounds', () => {
    const values = {
      user_id: 'user-1',
      workout_id: 'workout-1',
      exercise: 'Bench press',
      set_number: 1,
      reps: 8,
      weight_kg: 50.5,
    };
    expect(isValidWorkoutSetValues(values)).toBe(true);
    expect(isValidWorkoutSetValues({ ...values, set_number: 0 })).toBe(false);
    expect(isValidWorkoutSetValues({ ...values, reps: 1001 })).toBe(false);
    expect(isValidWorkoutSetValues({ ...values, weight_kg: -1 })).toBe(false);
  });

  it('accepts each schema boundary and rejects values beyond the limits', () => {
    expect(
      isValidWorkoutValues({
        user_id: 'user-1',
        workout_date: '2026-10-28',
        name: 'W'.repeat(80),
        notes: 'N'.repeat(500),
      }),
    ).toBe(true);
    expect(
      isValidWorkoutValues({
        user_id: 'user-1',
        workout_date: '2026-10-28',
        name: 'W'.repeat(81),
        notes: null,
      }),
    ).toBe(false);
    expect(
      isValidWorkoutValues({
        user_id: 'user-1',
        workout_date: '2026-10-28',
        name: 'Workout',
        notes: 'N'.repeat(501),
      }),
    ).toBe(false);

    const maxSet = {
      user_id: 'user-1',
      workout_id: 'workout-1',
      exercise: 'E'.repeat(80),
      set_number: 100,
      reps: 1000,
      weight_kg: 1000,
    };
    expect(isValidWorkoutSetValues(maxSet)).toBe(true);
    expect(isValidWorkoutSetValues({ ...maxSet, exercise: 'E'.repeat(81) })).toBe(false);
    expect(isValidWorkoutSetValues({ ...maxSet, set_number: 101 })).toBe(false);
    expect(isValidWorkoutSetValues({ ...maxSet, reps: 1001 })).toBe(false);
    expect(isValidWorkoutSetValues({ ...maxSet, weight_kg: 1000.01 })).toBe(false);
    expect(
      isValidWorkoutSetEditValues({
        exercise: 'Exercise',
        set_number: 1,
        reps: 1,
        weight_kg: 0,
      }),
    ).toBe(true);
  });
});

describe('workout volume', () => {
  it('groups exercises without case differences and totals each exercise and session', () => {
    const sets = [
      set('set-1', 'Bench Press', 1, 10, 40),
      set('set-2', 'bench press', 2, 8, 45),
      set('set-3', 'Squat', 1, 5, 80),
    ];

    expect(groupWorkoutSets(sets)).toEqual([
      {
        exercise: 'Bench Press',
        volumeKg: 760,
        sets: sets.slice(0, 2),
      },
      {
        exercise: 'Squat',
        volumeKg: 400,
        sets: [sets[2]],
      },
    ]);
    expect(getWorkoutVolume(sets)).toBe(1160);
    expect(getWorkoutVolume([])).toBe(0);
  });

  it('renumbers remaining sets consecutively after a deletion, per exercise', () => {
    const remaining = [
      set('bench-3', 'Bench press', 3, 8, 45),
      set('squat-2', 'Squat', 2, 5, 80),
      set('bench-1', 'Bench press', 1, 10, 40),
    ];

    expect(renumberSetsByExercise(remaining).map(({ id, set_number }) => [id, set_number])).toEqual(
      [
        ['bench-1', 1],
        ['bench-3', 2],
        ['squat-2', 1],
      ],
    );
  });

  it('copies the previous workout exercises and sets into a new workout dated today', () => {
    expect(buildWorkoutCopy(workout, 'user-2', '2026-10-29')).toEqual({
      workout: {
        user_id: 'user-2',
        workout_date: '2026-10-29',
        name: 'Upper body',
        notes: null,
      },
      sets: [
        {
          user_id: 'user-2',
          exercise: 'Bench press',
          set_number: 1,
          reps: 10,
          weight_kg: 40,
        },
        {
          user_id: 'user-2',
          exercise: 'Bench press',
          set_number: 2,
          reps: 8,
          weight_kg: 45,
        },
      ],
    });
  });
});

describe('optimistic workout deletion', () => {
  it('rolls back the removed workout when deletion fails', async () => {
    const client = new QueryClient();
    const key = ['workouts', 'user-1'];
    client.setQueryData(key, [workout]);

    await expect(
      runOptimisticWorkoutMutation(
        client,
        key,
        (workouts) => workouts.filter((item) => item.id !== workout.id),
        async () => {
          throw new Error('delete failed');
        },
      ),
    ).rejects.toThrow('delete failed');

    expect(client.getQueryData(key)).toEqual([workout]);
    client.clear();
  });
});
