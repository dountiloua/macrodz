import type { LookupError } from './types';

export type BarcodeNormalizationResult =
  { ok: true; barcode: string } | { ok: false; error: LookupError };

const EAN_8_LENGTH = 8;
const UPC_A_LENGTH = 12;
const EAN_13_LENGTH = 13;

export function normalizeBarcode(input: string): BarcodeNormalizationResult {
  if (typeof input !== 'string') {
    return { ok: false, error: { code: 'INVALID_BARCODE' } };
  }

  const digits = input.replace(/\s/g, '');

  if (!/^\d+$/.test(digits)) {
    return { ok: false, error: { code: 'INVALID_BARCODE' } };
  }

  if (digits.length === EAN_8_LENGTH || digits.length === EAN_13_LENGTH) {
    return { ok: true, barcode: digits };
  }

  if (digits.length === UPC_A_LENGTH) {
    return { ok: true, barcode: `0${digits}` };
  }

  return { ok: false, error: { code: 'INVALID_BARCODE' } };
}
