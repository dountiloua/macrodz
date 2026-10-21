import { describe, expect, it } from '@jest/globals';

import { en } from '@/lib/locales/en';
import { fr } from '@/lib/locales/fr';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function emptyKeys(locale: object): string[] {
  return flattenKeys(locale).filter((key) => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        locale,
      );

    return typeof value !== 'string' || value.trim().length === 0;
  });
}

describe('locales', () => {
  it('define the same translation keys in English and French', () => {
    expect(flattenKeys(fr).sort()).toEqual(flattenKeys(en).sort());
  });

  it('have no empty translations', () => {
    expect(emptyKeys(en)).toEqual([]);
    expect(emptyKeys(fr)).toEqual([]);
  });
});
