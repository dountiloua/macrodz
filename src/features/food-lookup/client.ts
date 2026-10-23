import {
  buildProductUrl,
  buildUserAgent,
  CONTACT_EMAIL_ENV,
  OFF_MAX_RETRIES,
  OFF_RETRY_DELAY_MS,
  OFF_TIMEOUT_MS,
} from './constants';
import type {
  FetchLike,
  LookupError,
  OpenFoodFactsFetchResult,
  OpenFoodFactsRawProduct,
} from './types';

export type OpenFoodFactsClientOptions = {
  fetch?: FetchLike;
  userAgent?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readResponseBody(body: unknown): OpenFoodFactsFetchResult {
  if (!isRecord(body)) {
    return { ok: false, error: { code: 'INVALID_DATA' } };
  }

  if (body.status === 0) {
    return { ok: false, error: { code: 'NOT_FOUND' } };
  }

  const product = body.product;

  if (!isRecord(product)) {
    return { ok: false, error: { code: 'NOT_FOUND' } };
  }

  return { ok: true, raw: product as OpenFoodFactsRawProduct };
}

export async function fetchOpenFoodFactsProduct(
  barcode: string,
  options: OpenFoodFactsClientOptions = {},
): Promise<OpenFoodFactsFetchResult> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const userAgent =
    options.userAgent ?? buildUserAgent(process.env[CONTACT_EMAIL_ENV] as string | undefined);
  const timeoutMs = options.timeoutMs ?? OFF_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? OFF_MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? OFF_RETRY_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;
  const url = buildProductUrl(barcode);

  let lastError: LookupError = { code: 'NETWORK_ERROR' };

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchImpl(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (response.status === 404 || response.status === 0) {
        return { ok: false, error: { code: 'NOT_FOUND' } };
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = { code: 'HTTP_ERROR', status: response.status };
      } else if (!response.ok) {
        return { ok: false, error: { code: 'HTTP_ERROR', status: response.status } };
      } else {
        let body: unknown;

        try {
          body = await response.json();
        } catch {
          return { ok: false, error: { code: 'INVALID_DATA' } };
        }

        return readResponseBody(body);
      }
    } catch {
      lastError = timedOut ? { code: 'TIMEOUT' } : { code: 'NETWORK_ERROR' };
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < maxRetries) {
      await sleep(retryDelayMs * 2 ** attempt);
    }
  }

  return { ok: false, error: lastError };
}
