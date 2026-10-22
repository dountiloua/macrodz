import { describe, expect, it } from '@jest/globals';

import { activityMultiplier, calculateTdee } from '../tdee';

describe('activityMultiplier', () => {
  it.each([
    [0, 1.2],
    [1, 1.2],
    [2, 1.375],
    [3, 1.375],
    [4, 1.55],
    [5, 1.55],
    [6, 1.725],
    [7, 1.725],
  ])('maps %i training days to %d', (days, expected) => {
    expect(activityMultiplier(days)).toBe(expected);
  });

  it.each([-1, 8, 2.5])('rejects invalid training days (%p)', (days) => {
    expect(() => activityMultiplier(days)).toThrow(RangeError);
  });
});

describe('calculateTdee', () => {
  it('multiplies BMR by the activity multiplier', () => {
    expect(calculateTdee(1780, 3)).toBeCloseTo(2447.5, 5);
    expect(calculateTdee(1780, 0)).toBeCloseTo(2136, 5);
    expect(calculateTdee(1780, 7)).toBeCloseTo(3070.5, 5);
  });
});
