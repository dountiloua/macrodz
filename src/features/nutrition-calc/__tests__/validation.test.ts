import { describe, expect, it } from '@jest/globals';

import { validateNumericField } from '../validation';

describe('validateNumericField', () => {
  it('rejects an empty value', () => {
    expect(validateNumericField('age', '   ')).toEqual({ valid: false, code: 'REQUIRED' });
  });

  it('rejects non-numeric text', () => {
    expect(validateNumericField('weightKg', 'abc')).toEqual({
      valid: false,
      code: 'INVALID_NUMBER',
    });
  });

  it('accepts a decimal comma', () => {
    expect(validateNumericField('weightKg', '72,5')).toEqual({ valid: true, value: 72.5 });
  });

  describe('age', () => {
    it('accepts the boundaries', () => {
      expect(validateNumericField('age', '18')).toEqual({ valid: true, value: 18 });
      expect(validateNumericField('age', '90')).toEqual({ valid: true, value: 90 });
    });

    it('rejects under 18 with a dedicated code', () => {
      expect(validateNumericField('age', '17')).toEqual({ valid: false, code: 'AGE_TOO_LOW' });
    });

    it('rejects over 90', () => {
      expect(validateNumericField('age', '91')).toEqual({ valid: false, code: 'AGE_TOO_HIGH' });
    });

    it('rejects fractional ages', () => {
      expect(validateNumericField('age', '30,5')).toEqual({
        valid: false,
        code: 'INVALID_NUMBER',
      });
    });
  });

  describe('height', () => {
    it.each([
      ['119', false],
      ['120', true],
      ['230', true],
      ['231', false],
    ])('validates %s', (input, valid) => {
      const result = validateNumericField('heightCm', input);
      expect(result.valid).toBe(valid);
      if (!result.valid) {
        expect(result.code).toBe('HEIGHT_OUT_OF_RANGE');
      }
    });

    it('accepts decimals', () => {
      expect(validateNumericField('heightCm', '180.5')).toEqual({ valid: true, value: 180.5 });
    });
  });

  describe('weight', () => {
    it.each([
      ['34.9', false],
      ['35', true],
      ['300', true],
      ['300.1', false],
    ])('validates %s', (input, valid) => {
      const result = validateNumericField('weightKg', input);
      expect(result.valid).toBe(valid);
      if (!result.valid) {
        expect(result.code).toBe('WEIGHT_OUT_OF_RANGE');
      }
    });
  });

  describe('body fat', () => {
    it.each([
      ['2.9', false],
      ['3', true],
      ['60', true],
      ['60.1', false],
    ])('validates %s', (input, valid) => {
      const result = validateNumericField('bodyFatPercent', input);
      expect(result.valid).toBe(valid);
      if (!result.valid) {
        expect(result.code).toBe('BODY_FAT_OUT_OF_RANGE');
      }
    });
  });

  describe('training days', () => {
    it.each([
      ['-1', false],
      ['0', true],
      ['7', true],
      ['8', false],
    ])('validates %s', (input, valid) => {
      const result = validateNumericField('trainingDaysPerWeek', input);
      expect(result.valid).toBe(valid);
      if (!result.valid) {
        expect(result.code).toBe('TRAINING_DAYS_OUT_OF_RANGE');
      }
    });

    it('rejects fractional days', () => {
      expect(validateNumericField('trainingDaysPerWeek', '2.5')).toEqual({
        valid: false,
        code: 'INVALID_NUMBER',
      });
    });
  });
});
