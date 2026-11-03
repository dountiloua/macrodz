export function formatCalories(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '—' : String(Math.round(value));
}

export function formatMacro(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(1);
}
