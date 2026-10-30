export type BodyMetric = {
  id: string;
  user_id: string;
  entry_date: string;
  weight_kg: number;
  chest_cm: number | null;
  waist_cm: number | null;
  arms_cm: number | null;
  thighs_cm: number | null;
  created_at: string;
  updated_at: string;
};

export type BodyMetricValues = Pick<
  BodyMetric,
  'user_id' | 'entry_date' | 'weight_kg' | 'chest_cm' | 'waist_cm' | 'arms_cm' | 'thighs_cm'
>;

export type BodyMetricFormValues = {
  entry_date: string;
  weight_kg: string;
  chest_cm: string;
  waist_cm: string;
  arms_cm: string;
  thighs_cm: string;
};

export type WeeklyWeightAverage = {
  weekStart: string;
  averageKg: number;
  entries: number;
};

export type MovingAveragePoint = {
  entry_date: string;
  averageKg: number;
};

export type BodyMetricTrendDirection = 'up' | 'down' | 'neutral';
