import type { BmrInput, BmrResult } from './types';

const MIFFLIN_MALE_OFFSET = 5;
const MIFFLIN_FEMALE_OFFSET = -161;
const KATCH_BASE = 370;
const KATCH_LEAN_MASS_FACTOR = 21.6;

export function calculateBmr(input: BmrInput): BmrResult {
  if (input.bodyFatPercent !== undefined) {
    const leanMassKg = input.weightKg * (1 - input.bodyFatPercent / 100);
    return {
      bmr: KATCH_BASE + KATCH_LEAN_MASS_FACTOR * leanMassKg,
      formula: 'katch-mcardle',
    };
  }

  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  const offset = input.gender === 'male' ? MIFFLIN_MALE_OFFSET : MIFFLIN_FEMALE_OFFSET;

  return {
    bmr: base + offset,
    formula: 'mifflin-st-jeor',
  };
}
