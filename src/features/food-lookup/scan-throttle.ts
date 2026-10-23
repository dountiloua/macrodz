export const DEFAULT_SCAN_COOLDOWN_MS = 2000;

export function shouldAcceptBarcode(
  lastBarcode: string | null,
  lastScannedAt: number,
  newBarcode: string,
  now: number,
  cooldownMs: number = DEFAULT_SCAN_COOLDOWN_MS,
): boolean {
  const trimmed = newBarcode.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (lastBarcode === trimmed && now - lastScannedAt < cooldownMs) {
    return false;
  }

  return true;
}
