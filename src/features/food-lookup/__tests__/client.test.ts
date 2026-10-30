import { describe, expect, it } from '@jest/globals';

import { fetchOpenFoodFactsProduct } from '../client';
import { buildProductUrl } from '../constants';
import type { FetchInit, FetchLike, HttpResponse } from '../types';

const BARCODE = '6131234567890';

const productBody = {
  status: 1,
  product: {
    code: BARCODE,
    product_name: 'Lait',
    nutriments: {
      'energy-kcal_100g': 64,
      proteins_100g: 3.4,
      carbohydrates_100g: 4.8,
      fat_100g: 3.6,
    },
  },
};

type Call = { url: string; init: FetchInit };

function jsonResponse(body: unknown, status = 200): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function createSequentialFetch(responses: (HttpResponse | Error)[]): {
  fetchImpl: FetchLike;
  calls: Call[];
} {
  const queue = [...responses];
  const calls: Call[] = [];

  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const next = queue.length > 1 ? queue.shift() : queue[0];

    if (next === undefined) {
      throw new Error('No mock response configured');
    }

    if (next instanceof Error) {
      throw next;
    }

    return next;
  };

  return { fetchImpl, calls };
}

const noSleep = async () => {};

describe('fetchOpenFoodFactsProduct', () => {
  it('returns the raw product and sends the expected URL and User-Agent', async () => {
    const { fetchImpl, calls } = createSequentialFetch([jsonResponse(productBody)]);
    const result = await fetchOpenFoodFactsProduct(BARCODE, {
      fetch: fetchImpl,
      userAgent: 'MacroDZ/1.0 (test@example.com)',
    });

    expect(result).toEqual({ ok: true, raw: productBody.product });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(buildProductUrl(BARCODE));
    expect(calls[0].url).toContain('fields=');
    for (const field of [
      'product_name_fr',
      'product_name_en',
      'product_name_ar',
      'generic_name',
      'image_front_small_url',
      'image_front_url',
    ]) {
      expect(calls[0].url).toContain(field);
    }
    expect(calls[0].init.headers['User-Agent']).toBe('MacroDZ/1.0 (test@example.com)');
  });

  it('retries a 429 and succeeds on the next attempt', async () => {
    const { fetchImpl, calls } = createSequentialFetch([
      jsonResponse({}, 429),
      jsonResponse(productBody),
    ]);
    const result = await fetchOpenFoodFactsProduct(BARCODE, {
      fetch: fetchImpl,
      sleep: noSleep,
      retryDelayMs: 0,
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('returns NETWORK_ERROR after retrying network failures', async () => {
    const { fetchImpl, calls } = createSequentialFetch([new Error('offline')]);
    const result = await fetchOpenFoodFactsProduct(BARCODE, {
      fetch: fetchImpl,
      sleep: noSleep,
      retryDelayMs: 0,
    });

    expect(result).toEqual({ ok: false, error: { code: 'NETWORK_ERROR' } });
    expect(calls).toHaveLength(3);
  });

  it('returns TIMEOUT when the request exceeds the limit', async () => {
    let calls = 0;
    const hangingFetch: FetchLike = (_url, init) => {
      calls += 1;

      return new Promise<HttpResponse>((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
      });
    };

    const result = await fetchOpenFoodFactsProduct(BARCODE, {
      fetch: hangingFetch,
      timeoutMs: 10,
      sleep: noSleep,
      retryDelayMs: 0,
    });

    expect(result).toEqual({ ok: false, error: { code: 'TIMEOUT' } });
    expect(calls).toBe(3);
  });

  it('does not retry a 404', async () => {
    const { fetchImpl, calls } = createSequentialFetch([jsonResponse({}, 404)]);
    const result = await fetchOpenFoodFactsProduct(BARCODE, {
      fetch: fetchImpl,
      sleep: noSleep,
    });

    expect(result).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(calls).toHaveLength(1);
  });

  it('does not retry status 0', async () => {
    const { fetchImpl, calls } = createSequentialFetch([jsonResponse({}, 0)]);
    const result = await fetchOpenFoodFactsProduct(BARCODE, {
      fetch: fetchImpl,
      sleep: noSleep,
    });

    expect(result).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(calls).toHaveLength(1);
  });

  it('treats a missing product in the body as NOT_FOUND', async () => {
    const { fetchImpl } = createSequentialFetch([jsonResponse({ status: 0 })]);
    const result = await fetchOpenFoodFactsProduct(BARCODE, { fetch: fetchImpl, sleep: noSleep });

    expect(result).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('returns HTTP_ERROR after exhausting retries on a 5xx', async () => {
    const { fetchImpl, calls } = createSequentialFetch([jsonResponse({}, 503)]);
    const result = await fetchOpenFoodFactsProduct(BARCODE, {
      fetch: fetchImpl,
      sleep: noSleep,
      retryDelayMs: 0,
    });

    expect(result).toEqual({ ok: false, error: { code: 'HTTP_ERROR', status: 503 } });
    expect(calls).toHaveLength(3);
  });
});
