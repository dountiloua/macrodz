import * as SQLite from 'expo-sqlite';

import type { CachedLookup, ParsedProduct, ProductCache } from './types';

const DATABASE_NAME = 'macro-dz.db';
const CACHE_VERSION = 2;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS product_cache (
    barcode TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL,
    payload TEXT,
    cached_at INTEGER NOT NULL
  );
`;

type CacheRow = {
  status: string;
  payload: string | null;
  cached_at: number;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (databasePromise === null) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await database.execAsync(CREATE_TABLE_SQL);
      const versionRow = await database.getFirstAsync<{
        user_version: number;
      }>('PRAGMA user_version');

      if (versionRow === null) {
        throw new Error('Unable to read product cache version');
      }

      const cacheVersion = versionRow.user_version;
      if (cacheVersion < CACHE_VERSION) {
        await database.execAsync(
          `DELETE FROM product_cache;
           PRAGMA user_version = ${CACHE_VERSION};`,
        );
      }

      return database;
    });
  }

  return databasePromise;
}

export function createSqliteProductCache(): ProductCache {
  return {
    async get(barcode: string): Promise<CachedLookup | null> {
      const database = await getDatabase();
      const row = await database.getFirstAsync<CacheRow>(
        'SELECT status, payload, cached_at FROM product_cache WHERE barcode = ?',
        [barcode],
      );

      if (row === null) {
        return null;
      }

      if (row.status === 'found' && row.payload !== null) {
        try {
          const product = JSON.parse(row.payload) as ParsedProduct;
          return { status: 'found', product, cachedAt: row.cached_at };
        } catch {
          return null;
        }
      }

      if (row.status === 'not_found') {
        return { status: 'not_found', cachedAt: row.cached_at };
      }

      return null;
    },

    async setFound(barcode: string, product: ParsedProduct, cachedAt: number): Promise<void> {
      const database = await getDatabase();
      await database.runAsync(
        `INSERT OR REPLACE INTO product_cache (barcode, status, payload, cached_at)
         VALUES (?, 'found', ?, ?)`,
        [barcode, JSON.stringify(product), cachedAt],
      );
    },

    async setNotFound(barcode: string, cachedAt: number): Promise<void> {
      const database = await getDatabase();
      await database.runAsync(
        `INSERT OR REPLACE INTO product_cache (barcode, status, payload, cached_at)
         VALUES (?, 'not_found', '', ?)`,
        [barcode, cachedAt],
      );
    },
  };
}
