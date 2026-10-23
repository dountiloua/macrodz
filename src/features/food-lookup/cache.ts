import { FOUND_TTL_MS, NOT_FOUND_TTL_MS } from './constants';
import type { CachedLookup, ParsedProduct, ProductCache } from './types';

export function isCacheEntryFresh(entry: CachedLookup, now: number): boolean {
  const ttl = entry.status === 'found' ? FOUND_TTL_MS : NOT_FOUND_TTL_MS;
  return entry.cachedAt + ttl > now;
}

export function createMemoryProductCache(): ProductCache {
  const entries = new Map<string, CachedLookup>();

  return {
    async get(barcode) {
      return entries.get(barcode) ?? null;
    },
    async setFound(barcode: string, product: ParsedProduct, cachedAt: number) {
      entries.set(barcode, { status: 'found', product, cachedAt });
    },
    async setNotFound(barcode: string, cachedAt: number) {
      entries.set(barcode, { status: 'not_found', cachedAt });
    },
  };
}
