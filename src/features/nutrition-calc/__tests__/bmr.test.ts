import { describe, expect, it } from '@jest/globals';

import { calculateBmr } from '../bmr';

describe('calculateBmr', () => {
  it('uses Mifflin-St Jeor for men when body fat is not provided', () => {
    const result = calculateBmr({
      gender: 'male',
      age: 30,
      weightKg: 80,
      heightCm: 180,
    });

    expect(result.formula).toBe('mifflin-st-jeor');
    expect(result.bmr).toBeCloseTo(1780, 5);
  });

  it('uses Mifflin-St Jeor for women when body fat is not provided', () => {
    const result = calculateBmr({
      gender: 'female',
      age: 30,
      weightKg: 60,
      heightCm: 165,
    });

    expect(result.formula).toBe('mifflin-st-jeor');
    expect(result.bmr).toBeCloseTo(1320.25, 5);
  });

  it('uses Katch-McArdle when body fat is provided', () => {
    const result = calculateBmr({
      gender: 'male',
      age: 30,
      weightKg: 80,
      heightCm: 180,
      bodyFatPercent: 18,
    });

    expect(result.formula).toBe('katch-mcardle');
    expect(result.bmr).toBeCloseTo(1786.96, 5);
  });

  it('ignores gender for Katch-McArdle', () => {
    const male = calculateBmr({
      gender: 'male',
      age: 30,
      weightKg: 80,
      heightCm: 180,
      bodyFatPercent: 18,
    });
    const female = calculateBmr({
      gender: 'female',
      age: 45,
      weightKg: 80,
      heightCm: 160,
      bodyFatPercent: 18,
    });

    expect(female.bmr).toBeCloseTo(male.bmr, 10);
  });
});
