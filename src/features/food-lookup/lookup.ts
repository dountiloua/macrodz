import { normalizeBarcode } from './barcode';
import { isCacheEntryFresh } from './cache';
import { fetchOpenFoodFactsProduct, type OpenFoodFactsClientOptions } from './client';
import { parseOpenFoodFactsProduct } from './parser';
import type { LookupResult, ProductCache } from './types';

export type LookupDependencies = {
  cache?: ProductCache;
  fetch?: OpenFoodFactsClientOptions['fetch'];
  userAgent?: string;
  now?: () => number;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  sleep?: OpenFoodFactsClientOptions['sleep'];
};

let defaultCachePromise: Promise<ProductCache> | null = null;

export function getDefaultCache(): Promise<ProductCache> {
  if (defaultCachePromise === null) {
    defaultCachePromise = import('./sqlite-cache').then(({ createSqliteProductCache }) =>
      createSqliteProductCache(),
    );
  }

  return defaultCachePromise;
}

async function resolveCache(explicit?: ProductCache): Promise<ProductCache | null> {
  if (explicit !== undefined) {
    return explicit;
  }

  try {
    return await getDefaultCache();
  } catch {
    return null;
  }
}

async function attempt<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  } catch {
    return null;
  }
}

export async function lookupProduct(
  barcode: string,
  dependencies: LookupDependencies = {},
): Promise<LookupResult> {
  const normalized = normalizeBarcode(barcode);

  if (!normalized.ok) {
    return { ok: false, error: normalized.error };
  }

  const now = dependencies.now?.() ?? Date.now();
  const cache = await resolveCache(dependencies.cache);

  if (cache !== null) {
    const entry = await attempt(() => cache.get(normalized.barcode));

    if (entry !== null && isCacheEntryFresh(entry, now)) {
      if (entry.status === 'found') {
        return { ok: true, product: entry.product, source: 'cache' };
      }

      return { ok: false, error: { code: 'NOT_FOUND' } };
    }
  }

  const fetched = await fetchOpenFoodFactsProduct(normalized.barcode, {
    fetch: dependencies.fetch,
    userAgent: dependencies.userAgent,
    timeoutMs: dependencies.timeoutMs,
    maxRetries: dependencies.maxRetries,
    retryDelayMs: dependencies.retryDelayMs,
    sleep: dependencies.sleep,
  });

  if (!fetched.ok) {
    if (fetched.error.code === 'NOT_FOUND' && cache !== null) {
      await attempt(() => cache.setNotFound(normalized.barcode, now));
    }

    return { ok: false, error: fetched.error };
  }

  const parsed = parseOpenFoodFactsProduct(fetched.raw, normalized.barcode);

  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  if (cache !== null) {
    await attempt(() => cache.setFound(normalized.barcode, parsed.product, now));
  }

  return { ok: true, product: parsed.product, source: 'network' };
}
