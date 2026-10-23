import { describe, expect, it } from '@jest/globals';

import { normalizeBarcode } from '../barcode';

describe('normalizeBarcode', () => {
  it('strips spaces before validating', () => {
    expect(normalizeBarcode(' 613 123 456 7890 ')).toEqual({
      ok: true,
      barcode: '6131234567890',
    });
  });

  it('accepts EAN-8 unchanged', () => {
    expect(normalizeBarcode('12345678')).toEqual({ ok: true, barcode: '12345678' });
  });

  it('accepts EAN-13 unchanged', () => {
    expect(normalizeBarcode('6131234567890')).toEqual({ ok: true, barcode: '6131234567890' });
  });

  it('pads UPC-A to 13 digits', () => {
    expect(normalizeBarcode('012345678905')).toEqual({
      ok: true,
      barcode: '0012345678905',
    });
    expect(normalizeBarcode('123456789012')).toEqual({
      ok: true,
      barcode: '0123456789012',
    });
  });

  it('rejects non-numeric input', () => {
    expect(normalizeBarcode('61312A4567890')).toEqual({
      ok: false,
      error: { code: 'INVALID_BARCODE' },
    });
    expect(normalizeBarcode('barcode')).toEqual({
      ok: false,
      error: { code: 'INVALID_BARCODE' },
    });
  });

  it('rejects wrong lengths', () => {
    for (const barcode of ['', '1234567', '123456789', '12345678901', '12345678901234']) {
      expect(normalizeBarcode(barcode)).toEqual({
        ok: false,
        error: { code: 'INVALID_BARCODE' },
      });
    }
  });
});
