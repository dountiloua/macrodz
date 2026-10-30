export const OFF_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';

export const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_fr',
  'product_name_en',
  'product_name_ar',
  'generic_name',
  'brands',
  'image_front_small_url',
  'image_front_url',
  'serving_size',
  'serving_quantity',
  'quantity',
  'nutriments',
  'countries_tags',
].join(',');

export const OFF_TIMEOUT_MS = 8000;

export const OFF_MAX_RETRIES = 2;

export const OFF_RETRY_DELAY_MS = 500;

export const USER_AGENT_NAME = 'MacroDZ/1.0';

export const CONTACT_EMAIL_ENV = 'EXPO_PUBLIC_CONTACT_EMAIL';

export const FOUND_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;

export function buildUserAgent(contactEmail?: string): string {
  const email = contactEmail?.trim();

  return email ? `${USER_AGENT_NAME} (${email})` : `${USER_AGENT_NAME} (no-contact-configured)`;
}

export function buildProductUrl(barcode: string): string {
  return `${OFF_BASE_URL}/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
}
