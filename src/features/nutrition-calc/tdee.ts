import { ACTIVITY_MULTIPLIERS } from './constants';

export function activityMultiplier(trainingDaysPerWeek: number): number {
  if (
    !Number.isInteger(trainingDaysPerWeek) ||
    trainingDaysPerWeek < 0 ||
    trainingDaysPerWeek > 7
  ) {
    throw new RangeError('trainingDaysPerWeek must be an integer between 0 and 7');
  }

  const bracket = ACTIVITY_MULTIPLIERS.find(
    (candidate) => trainingDaysPerWeek <= candidate.maxDaysPerWeek,
  );

  if (!bracket) {
    throw new RangeError('No activity multiplier for the given training days');
  }

  return bracket.multiplier;
}

export function calculateTdee(bmr: number, trainingDaysPerWeek: number): number {
  return bmr * activityMultiplier(trainingDaysPerWeek);
}
