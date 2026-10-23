import type { ServingProduct } from '../serving-units/types';

export type ProductSource = 'off' | 'user';

export type ParsedProduct = ServingProduct & {
  barcode: string;
  name: string;
  brand?: string;
  servingSize?: string;
  countriesTags: string[];
  isLikelyAlgerian: boolean;
  source?: ProductSource;
};

export type LookupError =
  | { code: 'INVALID_BARCODE' }
  | { code: 'NOT_FOUND' }
  | { code: 'INCOMPLETE_DATA' }
  | { code: 'INVALID_DATA' }
  | { code: 'NETWORK_ERROR' }
  | { code: 'TIMEOUT' }
  | { code: 'HTTP_ERROR'; status: number };

export type LookupSuccess = {
  ok: true;
  product: ParsedProduct;
  source: 'cache' | 'network';
};

export type LookupFailure = {
  ok: false;
  error: LookupError;
};

export type LookupResult = LookupSuccess | LookupFailure;

export type ParseResult = { ok: true; product: ParsedProduct } | { ok: false; error: LookupError };

export type OpenFoodFactsRawProduct = {
  code?: string | number;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: string | number;
  quantity?: string;
  countries_tags?: unknown;
  nutriments?: Record<string, unknown>;
};

export type CachedLookup =
  | { status: 'found'; product: ParsedProduct; cachedAt: number }
  | { status: 'not_found'; cachedAt: number };

export type ProductCache = {
  get(barcode: string): Promise<CachedLookup | null>;
  setFound(barcode: string, product: ParsedProduct, cachedAt: number): Promise<void>;
  setNotFound(barcode: string, cachedAt: number): Promise<void>;
};

export type HttpResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type FetchInit = {
  headers: Record<string, string>;
  signal: AbortSignal;
};

export type FetchLike = (url: string, init: FetchInit) => Promise<HttpResponse>;

export type OpenFoodFactsFetchResult =
  { ok: true; raw: OpenFoodFactsRawProduct } | { ok: false; error: LookupError };
