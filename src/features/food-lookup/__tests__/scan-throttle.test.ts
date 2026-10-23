import { describe, expect, it } from '@jest/globals';

import { DEFAULT_SCAN_COOLDOWN_MS, shouldAcceptBarcode } from '../scan-throttle';

describe('shouldAcceptBarcode', () => {
  const BARCODE_A = '6131234567890';
  const BARCODE_B = '6139876543210';
  const T0 = 10_000;

  it('rejects empty or whitespace-only barcode', () => {
    expect(shouldAcceptBarcode(null, 0, '', T0)).toBe(false);
    expect(shouldAcceptBarcode(null, 0, '   ', T0)).toBe(false);
  });

  it('accepts the first scan when lastBarcode is null', () => {
    expect(shouldAcceptBarcode(null, 0, BARCODE_A, T0)).toBe(true);
  });

  it('rejects the same barcode within cooldown window', () => {
    // 500 ms elapsed < 2000 ms cooldown
    expect(shouldAcceptBarcode(BARCODE_A, T0, BARCODE_A, T0 + 500)).toBe(false);
    expect(shouldAcceptBarcode(BARCODE_A, T0, BARCODE_A, T0 + 1999)).toBe(false);
  });

  it('accepts the same barcode after cooldown window has elapsed', () => {
    // Exactly 2000 ms elapsed
    expect(shouldAcceptBarcode(BARCODE_A, T0, BARCODE_A, T0 + DEFAULT_SCAN_COOLDOWN_MS)).toBe(true);
    // 3000 ms elapsed
    expect(shouldAcceptBarcode(BARCODE_A, T0, BARCODE_A, T0 + 3000)).toBe(true);
  });

  it('accepts a different barcode immediately even within cooldown window', () => {
    expect(shouldAcceptBarcode(BARCODE_A, T0, BARCODE_B, T0 + 100)).toBe(true);
  });

  it('supports custom cooldown duration', () => {
    const customCooldown = 5000;
    expect(shouldAcceptBarcode(BARCODE_A, T0, BARCODE_A, T0 + 3000, customCooldown)).toBe(false);
    expect(shouldAcceptBarcode(BARCODE_A, T0, BARCODE_A, T0 + 5001, customCooldown)).toBe(true);
  });
});
