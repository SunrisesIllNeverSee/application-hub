// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// LF-08 — read-only catalog cache adapter. Public opportunity/question
// catalog data fetched by CALLER code (outside this module) is stored
// inbound-only so offline browse works. This module never fetches.

import { nowIso } from './crypto.ts'
import type { VaultStorage } from './vault.ts'
import type { CatalogCacheRecord } from './schema.ts'

export const DEFAULT_CATALOG_TTL_MS = 24 * 60 * 60 * 1000

export type CatalogFlag = 'cached'

export interface CatalogHit {
  flag: CatalogFlag
  blob: unknown
  fetched_at: string
  /** True when the entry is older than the TTL — still served, marked stale. */
  stale: boolean
}

/** Inbound-only write: cache a catalog payload fetched elsewhere. */
export async function putCatalog(storage: VaultStorage, key: string, blob: unknown): Promise<void> {
  const record: CatalogCacheRecord = { key, blob, fetched_at: nowIso() }
  await storage.put('catalog_cache', record)
}

/** Read the cache with a TTL. Returns null when absent; stale entries still return with stale=true. */
export async function getCatalog(
  storage: VaultStorage,
  key: string,
  ttlMs: number = DEFAULT_CATALOG_TTL_MS,
): Promise<CatalogHit | null> {
  const record = await storage.get<CatalogCacheRecord>('catalog_cache', key)
  if (!record) return null
  const age = Date.now() - Date.parse(record.fetched_at)
  return { flag: 'cached', blob: record.blob, fetched_at: record.fetched_at, stale: age > ttlMs }
}

/** Offline browse: serve whatever is cached regardless of TTL; null when absent. */
export async function getCatalogOffline(storage: VaultStorage, key: string): Promise<CatalogHit | null> {
  const record = await storage.get<CatalogCacheRecord>('catalog_cache', key)
  if (!record) return null
  return { flag: 'cached', blob: record.blob, fetched_at: record.fetched_at, stale: true }
}
