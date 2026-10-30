import type { BodyMetricFormValues, BodyMetricValues } from './types';

export type BodyMetricValidationCode =
  | 'INVALID_DATE'
  | 'INVALID_WEIGHT'
  | 'INVALID_CHEST'
  | 'INVALID_WAIST'
  | 'INVALID_ARMS'
  | 'INVALID_THIGHS';

export type BodyMetricFormResult =
  | { valid: true; values: Omit<BodyMetricValues, 'user_id'> }
  | { valid: false; code: BodyMetricValidationCode };

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    Number.isFinite(year) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseMeasurement(
  raw: string,
  min: number,
  max: number,
  decimals: number,
): number | null | undefined {
  const normalized = raw.trim().replace(',', '.');
  if (normalized.length === 0) return null;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return undefined;

  const value = Number(normalized);
  const fraction = normalized.split('.')[1] ?? '';
  if (!Number.isFinite(value) || value < min || value > max || fraction.length > decimals) {
    return undefined;
  }
  return value;
}

export function parseBodyMetricForm(values: BodyMetricFormValues): BodyMetricFormResult {
  const entryDate = values.entry_date.trim();
  if (!isValidDate(entryDate)) return { valid: false, code: 'INVALID_DATE' };

  const weight = parseMeasurement(values.weight_kg, 20, 500, 2);
  if (weight === null || weight === undefined) {
    return { valid: false, code: 'INVALID_WEIGHT' };
  }

  const chest = parseMeasurement(values.chest_cm, 20, 300, 1);
  if (chest === undefined) return { valid: false, code: 'INVALID_CHEST' };
  const waist = parseMeasurement(values.waist_cm, 20, 300, 1);
  if (waist === undefined) return { valid: false, code: 'INVALID_WAIST' };
  const arms = parseMeasurement(values.arms_cm, 10, 150, 1);
  if (arms === undefined) return { valid: false, code: 'INVALID_ARMS' };
  const thighs = parseMeasurement(values.thighs_cm, 10, 200, 1);
  if (thighs === undefined) return { valid: false, code: 'INVALID_THIGHS' };

  return {
    valid: true,
    values: {
      entry_date: entryDate,
      weight_kg: weight,
      chest_cm: chest,
      waist_cm: waist,
      arms_cm: arms,
      thighs_cm: thighs,
    },
  };
}

export function isValidBodyMetricValues(values: BodyMetricValues): boolean {
  return (
    values.user_id.trim().length > 0 &&
    parseBodyMetricForm({
      entry_date: values.entry_date,
      weight_kg: String(values.weight_kg),
      chest_cm: values.chest_cm === null ? '' : String(values.chest_cm),
      waist_cm: values.waist_cm === null ? '' : String(values.waist_cm),
      arms_cm: values.arms_cm === null ? '' : String(values.arms_cm),
      thighs_cm: values.thighs_cm === null ? '' : String(values.thighs_cm),
    }).valid
  );
}
