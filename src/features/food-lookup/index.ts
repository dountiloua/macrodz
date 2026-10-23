export { normalizeBarcode } from './barcode';
export type { BarcodeNormalizationResult } from './barcode';
export { createMemoryProductCache, isCacheEntryFresh } from './cache';
export {
  buildProductUrl,
  buildUserAgent,
  CONTACT_EMAIL_ENV,
  FOUND_TTL_MS,
  NOT_FOUND_TTL_MS,
  OFF_BASE_URL,
  OFF_FIELDS,
  OFF_MAX_RETRIES,
  OFF_RETRY_DELAY_MS,
  OFF_TIMEOUT_MS,
  USER_AGENT_NAME,
} from './constants';
export { fetchOpenFoodFactsProduct } from './client';
export type { OpenFoodFactsClientOptions } from './client';
export { lookupProduct } from './lookup';
export type { LookupDependencies } from './lookup';
export { parseOpenFoodFactsProduct, parseServingSizeG } from './parser';
export type {
  CachedLookup,
  FetchInit,
  FetchLike,
  HttpResponse,
  LookupError,
  LookupFailure,
  LookupResult,
  LookupSuccess,
  OpenFoodFactsFetchResult,
  OpenFoodFactsRawProduct,
  ParsedProduct,
  ParseResult,
  ProductCache,
} from './types';
