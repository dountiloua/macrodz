import { describe, expect, it } from '@jest/globals';

import { formatCalories, formatMacro } from '../format';
import { transitionProductFlow } from '../state';

describe('product flow step transitions', () => {
  it('moves from the product sheet to the calculator on OK', () => {
    expect(transitionProductFlow('sheet', 'ok')).toBe('calculator');
  });

  it('closes the product sheet on Dismiss', () => {
    expect(transitionProductFlow('sheet', 'dismiss')).toBe('closed');
  });
});

describe('nutrition display formatting', () => {
  it('rounds kcal and macros only for display', () => {
    expect(formatCalories(201.6)).toBe('202');
    expect(formatMacro(3.456)).toBe('3.5');
  });

  it('renders missing nutrients as an em dash', () => {
    expect(formatMacro(undefined)).toBe('—');
    expect(formatMacro(Number.NaN)).toBe('—');
  });
});
