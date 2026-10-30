export type Workout = {
  id: string;
  user_id: string;
  workout_date: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  workout_sets: WorkoutSet[];
};

export type WorkoutSet = {
  id: string;
  workout_id: string;
  user_id: string;
  exercise: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  volume_kg: number;
  created_at: string;
};

export type WorkoutValues = Pick<Workout, 'user_id' | 'workout_date' | 'name' | 'notes'>;

export type WorkoutSetValues = Pick<
  WorkoutSet,
  'workout_id' | 'user_id' | 'exercise' | 'set_number' | 'reps' | 'weight_kg'
>;

export type WorkoutSetEditValues = Pick<
  WorkoutSet,
  'exercise' | 'set_number' | 'reps' | 'weight_kg'
>;

export type ExerciseVolume = {
  exercise: string;
  volumeKg: number;
  sets: WorkoutSet[];
};
