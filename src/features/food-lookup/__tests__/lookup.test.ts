import { describe, expect, it } from '@jest/globals';

import { createMemoryProductCache } from '../cache';
import { FOUND_TTL_MS, NOT_FOUND_TTL_MS } from '../constants';
import { lookupProduct } from '../lookup';
import type { FetchLike, HttpResponse, ParsedProduct } from '../types';

const BARCODE = '6131234567890';
const NOW = 1_700_000_000_000;

const rawProduct = {
  code: BARCODE,
  product_name: 'Lait Candia',
  brands: 'Candia',
  serving_size: '1 verre (240 ml)',
  countries_tags: ['en:algeria'],
  nutriments: {
    'energy-kcal_100g': 64,
    proteins_100g: 3.4,
    carbohydrates_100g: 4.8,
    fat_100g: 3.6,
  },
};

const cachedProduct: ParsedProduct = {
  barcode: BARCODE,
  name: 'Lait en cache',
  kcal: 64,
  protein: 3.4,
  carbs: 4.8,
  fat: 3.6,
  servingQuantityG: 240,
  countriesTags: ['en:algeria'],
  isLikelyAlgerian: true,
};

function successBody(product: unknown = rawProduct) {
  return { status: 1, product };
}

function jsonResponse(body: unknown, status = 200): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function countingFetch(response: HttpResponse | Error): {
  fetchImpl: FetchLike;
  calls: string[];
} {
  const calls: string[] = [];

  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);

    if (response instanceof Error) {
      throw response;
    }

    return response;
  };

  return { fetchImpl, calls };
}

const noSleep = async () => {};

function dependencies(cache = createMemoryProductCache()) {
  return {
    cache,
    now: () => NOW,
    sleep: noSleep,
    retryDelayMs: 0,
    userAgent: 'MacroDZ/1.0 (test@example.com)',
  };
}

describe('lookupProduct', () => {
  it('returns a parsed product from Open Food Facts and caches it', async () => {
    const cache = createMemoryProductCache();
    const { fetchImpl, calls } = countingFetch(jsonResponse(successBody()));
    const result = await lookupProduct(BARCODE, { ...dependencies(cache), fetch: fetchImpl });

    expect(result).toMatchObject({
      ok: true,
      source: 'network',
      product: {
        barcode: BARCODE,
        name: 'Lait Candia',
        kcal: 64,
        protein: 3.4,
        carbs: 4.8,
        fat: 3.6,
        servingQuantityG: 240,
        isLikelyAlgerian: true,
      },
    });
    expect(calls).toHaveLength(1);

    await expect(cache.get(BARCODE)).resolves.toMatchObject({
      status: 'found',
      cachedAt: NOW,
    });
  });

  it('serves a fresh cache hit without calling the network', async () => {
    const cache = createMemoryProductCache();
    await cache.setFound(BARCODE, cachedProduct, NOW - 1000);
    const { fetchImpl, calls } = countingFetch(new Error('network should not be used'));

    const result = await lookupProduct(BARCODE, { ...dependencies(cache), fetch: fetchImpl });

    expect(result).toEqual({ ok: true, product: cachedProduct, source: 'cache' });
    expect(calls).toHaveLength(0);
  });

  it('refreshes a cache entry older than 30 days', async () => {
    const cache = createMemoryProductCache();
    await cache.setFound(BARCODE, cachedProduct, NOW - FOUND_TTL_MS - 1);
    const { fetchImpl, calls } = countingFetch(jsonResponse(successBody()));

    const result = await lookupProduct(BARCODE, { ...dependencies(cache), fetch: fetchImpl });

    expect(result).toMatchObject({ ok: true, source: 'network' });
    expect(calls).toHaveLength(1);
  });

  it('caches NOT_FOUND for 24 hours', async () => {
    const cache = createMemoryProductCache();
    const { fetchImpl, calls } = countingFetch(jsonResponse({}, 404));

    const first = await lookupProduct(BARCODE, { ...dependencies(cache), fetch: fetchImpl });

    expect(first).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(calls).toHaveLength(1);
    await expect(cache.get(BARCODE)).resolves.toEqual({ status: 'not_found', cachedAt: NOW });

    const second = await lookupProduct(BARCODE, { ...dependencies(cache), fetch: fetchImpl });

    expect(second).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(calls).toHaveLength(1);
  });

  it('refreshes a cached NOT_FOUND after 24 hours', async () => {
    const cache = createMemoryProductCache();
    await cache.setNotFound(BARCODE, NOW - NOT_FOUND_TTL_MS - 1);
    const { fetchImpl, calls } = countingFetch(jsonResponse(successBody()));

    const result = await lookupProduct(BARCODE, { ...dependencies(cache), fetch: fetchImpl });

    expect(result).toMatchObject({ ok: true, source: 'network' });
    expect(calls).toHaveLength(1);
  });

  it('does not cache network errors and keeps them distinct from NOT_FOUND', async () => {
    const cache = createMemoryProductCache();
    const { fetchImpl } = countingFetch(new Error('offline'));

    const failed = await lookupProduct(BARCODE, { ...dependencies(cache), fetch: fetchImpl });

    expect(failed).toEqual({ ok: false, error: { code: 'NETWORK_ERROR' } });
    await expect(cache.get(BARCODE)).resolves.toBeNull();

    const retry = countingFetch(jsonResponse(successBody()));
    const succeeded = await lookupProduct(BARCODE, {
      ...dependencies(cache),
      fetch: retry.fetchImpl,
    });

    expect(succeeded).toMatchObject({ ok: true, source: 'network' });
    expect(retry.calls).toHaveLength(1);
  });

  it('rejects an invalid barcode without calling the network', async () => {
    const cache = createMemoryProductCache();
    const { fetchImpl, calls } = countingFetch(jsonResponse(successBody()));

    const result = await lookupProduct('not-a-barcode', {
      ...dependencies(cache),
      fetch: fetchImpl,
    });

    expect(result).toEqual({ ok: false, error: { code: 'INVALID_BARCODE' } });
    expect(calls).toHaveLength(0);
  });

  it('pads a UPC-A barcode before the lookup', async () => {
    const cache = createMemoryProductCache();
    const { fetchImpl, calls } = countingFetch(jsonResponse(successBody()));

    await lookupProduct('012345678905', { ...dependencies(cache), fetch: fetchImpl });

    expect(calls[0]).toContain('/0012345678905.json');
  });

  it('does not cache invalid nutrition data', async () => {
    const cache = createMemoryProductCache();
    const { fetchImpl } = countingFetch(
      jsonResponse(
        successBody({
          product_name: 'Impossible',
          nutriments: {
            'energy-kcal_100g': 400,
            proteins_100g: 40,
            carbohydrates_100g: 40,
            fat_100g: 30,
          },
        }),
      ),
    );

    const result = await lookupProduct(BARCODE, { ...dependencies(cache), fetch: fetchImpl });

    expect(result).toEqual({ ok: false, error: { code: 'INVALID_DATA' } });
    await expect(cache.get(BARCODE)).resolves.toBeNull();
  });
});
