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
export { classifyLookupError } from './error-mapping';
export type {
  ClassifiedErrorType,
  ErrorClassification,
  ScanErrorMessageKey,
} from './error-mapping';
export { getDefaultCache, lookupProduct } from './lookup';
export type { LookupDependencies } from './lookup';
export { saveManualProduct, validateManualProduct } from './manual-product';
export type {
  ManualProductInput,
  ManualProductValidationErrors,
  ManualProductValidationResult,
} from './manual-product';
export { parseOpenFoodFactsProduct, parseServingSizeG } from './parser';
export { DEFAULT_SCAN_COOLDOWN_MS, shouldAcceptBarcode } from './scan-throttle';
export {
  buildManualProductForm,
  getInitialServingSelection,
  normalizeManualBarcode,
} from './scan-handlers';
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
  ProductSource,
} from './types';
