import { describe, expect, it } from '@jest/globals';

import { calculateWeeklyWeightAverages } from '../trend';
import { isValidBodyMetricValues, parseBodyMetricForm } from '../validation';

const validForm = {
  entry_date: '2026-10-28',
  weight_kg: '72.55',
  chest_cm: '98.5',
  waist_cm: '',
  arms_cm: '34',
  thighs_cm: '',
};

describe('body metric validation', () => {
  it('parses valid values, decimal commas, and optional measurements', () => {
    expect(parseBodyMetricForm({ ...validForm, weight_kg: '72,55' })).toEqual({
      valid: true,
      values: {
        entry_date: '2026-10-28',
        weight_kg: 72.55,
        chest_cm: 98.5,
        waist_cm: null,
        arms_cm: 34,
        thighs_cm: null,
      },
    });
  });

  it('rejects invalid dates and impossible calendar dates', () => {
    expect(parseBodyMetricForm({ ...validForm, entry_date: '2026-02-29' })).toEqual({
      valid: false,
      code: 'INVALID_DATE',
    });
  });

  it('applies database bounds and supported decimal precision', () => {
    expect(parseBodyMetricForm({ ...validForm, weight_kg: '19.99' })).toEqual({
      valid: false,
      code: 'INVALID_WEIGHT',
    });
    expect(parseBodyMetricForm({ ...validForm, chest_cm: '98.55' })).toEqual({
      valid: false,
      code: 'INVALID_CHEST',
    });
    expect(parseBodyMetricForm({ ...validForm, thighs_cm: '200.1' })).toEqual({
      valid: false,
      code: 'INVALID_THIGHS',
    });
  });

  it('requires a valid weight and user identifier for saved values', () => {
    const values = {
      user_id: 'user-1',
      entry_date: '2026-10-28',
      weight_kg: 72.55,
      chest_cm: null,
      waist_cm: null,
      arms_cm: null,
      thighs_cm: null,
    };
    expect(isValidBodyMetricValues(values)).toBe(true);
    expect(isValidBodyMetricValues({ ...values, user_id: '' })).toBe(false);
    expect(isValidBodyMetricValues({ ...values, weight_kg: 500.01 })).toBe(false);
  });
});

describe('weekly weight averages', () => {
  it('groups entries by Monday-start calendar week, averages them, and sorts weeks', () => {
    expect(
      calculateWeeklyWeightAverages([
        { entry_date: '2026-10-28', weight_kg: 70 },
        { entry_date: '2026-10-26', weight_kg: 72 },
        { entry_date: '2026-11-01', weight_kg: 71 },
        { entry_date: '2026-10-19', weight_kg: 74 },
      ]),
    ).toEqual([
      { weekStart: '2026-10-19', averageKg: 74, entries: 1 },
      { weekStart: '2026-10-26', averageKg: 71, entries: 3 },
    ]);
  });

  it('returns no averages when there are no measurements', () => {
    expect(calculateWeeklyWeightAverages([])).toEqual([]);
  });
});
